"""
The laptop worker for Tantu's Qwen track (8 Oct). Asks the website for queued jobs, makes
each image with Qwen-Image-Edit-2511 in ComfyUI (then sharpens it up to 2K or 4K), uploads
it to the website's storage and reports done. Nothing is exposed from the laptop: it only
calls out, signed in with the laptop's own token (C:\\SareeAI\\.tantu-token).

  venv\\Scripts\\python tantu_worker.py            runs until closed; log tantu_worker.log
One copy at a time (port 9099). ComfyUI must be running on 127.0.0.1:8188.
"""
import json
import os
import socket
import sys
import time
import traceback
import urllib.error
import urllib.request
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qwen_edit_try as Q  # the ComfyUI calls

TANTU = os.environ.get("TANTU_BASE", "https://tantu-tryon.vercel.app").rstrip("/")
TOKEN = open(os.environ.get("TANTU_TOKEN_FILE", r"C:\SareeAI\.tantu-token")).read().strip()
LOG = os.environ.get("WORKER_LOG", r"C:\SareeAI\tantu_worker.log")
WORK = os.environ.get("WORKER_DIR", r"C:\SareeAI\worker")
UPSCALER = "4x-UltraSharp.safetensors"
UPSCALE_DIR = os.environ.get("UPSCALE_DIR", r"C:\ComfyUI\models\upscale_models")
NAME = os.environ.get("WORKER_NAME", "laptop")
POLL = 8  # seconds between asks when the queue is empty
UA = "TantuWorker/1.0"


def log(msg):
    line = f"{datetime.now():%d %b %H:%M:%S}  {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def tantu(path, body=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(TANTU + path, data=data, method=method or ("POST" if data else "GET"), headers={
        "Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read() or b"{}")


def fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 " + UA})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


def workflow(images, prompt, width, height, seed, upscale, steps=20, cfg=2.5):
    """Qwen edit with up to three input photos, then the sharpening upscaler to 2K (x2) or 4K (x4)."""
    if Q.LOADER == "full":
        loaders = {
            "1": {"class_type": "UNETLoader", "inputs": {"unet_name": Q.UNET, "weight_dtype": "default"}},
            "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": Q.CLIP, "type": "qwen_image"}},
        }
    else:
        loaders = {
            "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": Q.UNET}},
            "2": {"class_type": "CLIPLoaderGGUF", "inputs": {"clip_name": Q.CLIP, "type": "qwen_image"}},
        }
    w = {
        **loaders,
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": Q.VAE}},
        "5": {"class_type": "ModelSamplingAuraFlow", "inputs": {"shift": 3.0, "model": ["1", 0]}},
        "8": {"class_type": "EmptySD3LatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
    }
    refs = {}
    for i, name in enumerate(images[:3], 1):
        w[f"4{i}"] = {"class_type": "LoadImage", "inputs": {"image": name}}
        refs[f"image{i}"] = [f"4{i}", 0]
    w["6"] = {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["2", 0], "prompt": prompt, "vae": ["3", 0], **refs}}
    w["7"] = {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["2", 0], "prompt": "", "vae": ["3", 0], **refs}}
    w["9"] = {"class_type": "KSampler", "inputs": {"model": ["5", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["8", 0], "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}}
    w["10"] = {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["3", 0]}}
    last = ["10", 0]
    if upscale and os.path.exists(os.path.join(UPSCALE_DIR, UPSCALER)):
        w["12"] = {"class_type": "UpscaleModelLoader", "inputs": {"model_name": UPSCALER}}
        w["13"] = {"class_type": "ImageUpscaleWithModel", "inputs": {"upscale_model": ["12", 0], "image": last}}
        last = ["13", 0]
        if upscale == 2:  # the model is x4: bring it back to x2
            w["14"] = {"class_type": "ImageScaleBy", "inputs": {"upscale_method": "lanczos", "scale_by": 0.5, "image": last}}
            last = ["14", 0]
    w["11"] = {"class_type": "SaveImage", "inputs": {"images": last, "filename_prefix": "tantu-worker"}}
    return w


def run_job(job):
    os.makedirs(WORK, exist_ok=True)
    names = []
    for i, im in enumerate(job["images"], 1):
        ext = ".png" if im["url"].lower().endswith(".png") else ".jpg"
        names.append(Q.upload(fetch(im["url"], os.path.join(WORK, f"{job['id']}-{i}{ext}"))))
    t0 = time.time()
    wf = workflow(names, job["prompt"], job["width"], job["height"], job["seed"], job.get("upscale"))
    pid = Q.post("/prompt", json.dumps({"prompt": wf}).encode())["prompt_id"]
    while True:
        time.sleep(5)
        with urllib.request.urlopen(f"{Q.API}/history/{pid}", timeout=30) as r:
            hist = json.loads(r.read())
        if pid not in hist:
            continue
        status = hist[pid].get("status", {})
        if status.get("status_str") == "error":
            msgs = [m for m in status.get("messages", []) if m[0] == "execution_error"]
            raise RuntimeError("ComfyUI: " + json.dumps(msgs[-1][1] if msgs else status)[:600])
        img = next(i for o in hist[pid]["outputs"].values() for i in o.get("images", []))
        path = os.path.join(Q.COMFY_OUT, img.get("subfolder", ""), img["filename"])
        break
    ms = int((time.time() - t0) * 1000)
    # Up to storage on a signed URL, then the row closes.
    target = tantu("/api/worker/done", {"id": job["id"], "contentType": "image/png"})
    data = open(path, "rb").read()
    put = urllib.request.Request(target["url"], data=data, method="PUT", headers={"Content-Type": target["mime"]})
    with urllib.request.urlopen(put, timeout=600):
        pass
    tantu("/api/worker/done", {"id": job["id"], "key": target["key"], "mime": target["mime"], "ms": ms})
    return ms, len(data)


def main():
    guard = socket.socket()
    try:
        guard.bind(("127.0.0.1", 9099))
    except OSError:
        sys.exit("tantu_worker is already running")
    log(f"worker '{NAME}' up ({Q.LOADER} {Q.UNET}), asking {TANTU} every {POLL}s")
    while True:
        try:
            job = tantu("/api/worker/claim", {}).get("job")
        except Exception as e:
            log(f"could not reach the website: {e}")
            time.sleep(30)
            continue
        if not job:
            time.sleep(POLL)
            continue
        log(f"job {job['id'][:8]} {job.get('productCode')} {job['garmentType']} {job['promptId']} {job['width']}x{job['height']} x{job.get('upscale')}")
        try:
            ms, size = run_job(job)
            log(f"  done in {ms / 1000:.0f}s, {size / 1e6:.1f} MB")
        except Exception as e:
            log("  FAILED: " + "".join(traceback.format_exception_only(type(e), e)).strip())
            try:
                tantu("/api/worker/done", {"id": job["id"], "error": str(e)[:1000]})
            except Exception as e2:
                log(f"  and could not report it: {e2}")


if __name__ == "__main__":
    main()
