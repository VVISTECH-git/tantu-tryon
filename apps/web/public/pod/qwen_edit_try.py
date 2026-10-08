"""
One try-on with the squeezed Qwen-Image-Edit-2511 in ComfyUI on this laptop (8 Oct): free, slow.

  python qwen_edit_try.py <photo> "<what to do>" <out.png> [--size 896x1152] [--steps 20] [--cfg 2.5] [--seed N]

ComfyUI must be running on 127.0.0.1:8188 (Desktop/launch config "comfyui"). The photo is sent
to ComfyUI, the result is copied to <out.png>. Prints the time taken.
"""
import argparse
import json
import os
import random
import shutil
import sys
import time
import urllib.request

# The laptop's squeezed files by default; the rented GPU sets the full ones through the environment (8 Oct).
API = os.environ.get("COMFY_API", "http://127.0.0.1:8188")
UNET = os.environ.get("QWEN_UNET", "qwen-image-edit-2511-Q4_K_M.gguf")
CLIP = os.environ.get("QWEN_CLIP", "Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf")
VAE = os.environ.get("QWEN_VAE", "qwen_image_vae.safetensors")
COMFY_OUT = os.environ.get("COMFY_OUT", r"C:\ComfyUI\output")
# "gguf" loads with the ComfyUI-GGUF nodes; "full" with ComfyUI's own loaders (safetensors).
LOADER = os.environ.get("QWEN_LOADER", "gguf")


def post(path, body, headers=None):
    req = urllib.request.Request(API + path, data=body, headers=headers or {"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def upload(path):
    boundary = "----tantu" + str(random.randint(10**6, 10**7))
    name = os.path.basename(path)
    data = open(path, "rb").read()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{name}\"\r\nContent-Type: image/jpeg\r\n\r\n").encode() + data + f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n--{boundary}--\r\n".encode()
    return post("/upload/image", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})["name"]


def workflow(image, prompt, width, height, steps, cfg, seed):
    return {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": UNET}},
        "2": {"class_type": "CLIPLoaderGGUF", "inputs": {"clip_name": CLIP, "type": "qwen_image"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        "4": {"class_type": "LoadImage", "inputs": {"image": image}},
        "5": {"class_type": "ModelSamplingAuraFlow", "inputs": {"shift": 3.0, "model": ["1", 0]}},
        "6": {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["2", 0], "prompt": prompt, "vae": ["3", 0], "image1": ["4", 0]}},
        "7": {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["2", 0], "prompt": "", "vae": ["3", 0], "image1": ["4", 0]}},
        "8": {"class_type": "EmptySD3LatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "9": {"class_type": "KSampler", "inputs": {"model": ["5", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["8", 0], "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["3", 0]}},
        "11": {"class_type": "SaveImage", "inputs": {"images": ["10", 0], "filename_prefix": "tantu-edit"}},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("photo")
    ap.add_argument("prompt", help="the words, or kind:<garment> to use qwen_prompts.py (kind:kurti)")
    ap.add_argument("out")
    ap.add_argument("--size", default="896x1152")
    ap.add_argument("--steps", type=int, default=20)
    ap.add_argument("--cfg", type=float, default=2.5)
    ap.add_argument("--seed", type=int, default=None)
    a = ap.parse_args()
    w, h = (int(x) for x in a.size.lower().split("x"))
    seed = a.seed if a.seed is not None else random.randint(1, 2**31)
    if a.prompt.startswith("kind:"):
        import qwen_prompts
        a.prompt = qwen_prompts.prompt(a.prompt[5:])
    name = upload(a.photo)
    t0 = time.time()
    pid = post("/prompt", json.dumps({"prompt": workflow(name, a.prompt, w, h, a.steps, a.cfg, seed)}).encode())["prompt_id"]
    print(f"queued {pid} (seed {seed}, {w}x{h}, {a.steps} steps)", flush=True)
    while True:
        time.sleep(5)
        with urllib.request.urlopen(f"{API}/history/{pid}", timeout=30) as r:
            hist = json.loads(r.read())
        if pid not in hist:
            print(f"  {time.time() - t0:.0f}s ...", flush=True)
            continue
        status = hist[pid].get("status", {})
        if status.get("status_str") == "error":
            msgs = [m for m in status.get("messages", []) if m[0] == "execution_error"]
            sys.exit("ComfyUI error: " + json.dumps(msgs[-1][1] if msgs else status)[:800])
        outs = hist[pid]["outputs"]
        img = next(i for o in outs.values() for i in o.get("images", []))
        src = os.path.join(COMFY_OUT, img.get("subfolder", ""), img["filename"])
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        shutil.copy2(src, a.out)
        print(f"done in {time.time() - t0:.0f}s -> {a.out}", flush=True)
        return


if __name__ == "__main__":
    main()
