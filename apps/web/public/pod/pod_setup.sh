#!/usr/bin/env bash
# Tantu Qwen worker on a rented RunPod GPU (8 Oct). Runs once when the pod starts:
# ComfyUI + the full-quality Qwen-Image-Edit-2511 (fp8) + the sharpening upscaler, then the
# worker that serves the website's queue. Models live on the network volume (/workspace),
# so a restarted pod does not download them again.
set -euo pipefail
W=/workspace
M=$W/ComfyUI/models
LOG=$W/setup.log
exec > >(tee -a "$LOG") 2>&1
echo "== $(date) pod setup"

if [ ! -d $W/ComfyUI ]; then
  git clone -q https://github.com/comfyanonymous/ComfyUI.git $W/ComfyUI
fi
cd $W/ComfyUI
pip install -q -r requirements.txt 2>&1 | tail -1 || true
pip install -q huggingface_hub 2>&1 | tail -1 || true

get () {  # repo file dest
  if [ ! -s "$3" ]; then
    echo "downloading $2"
    python - "$1" "$2" "$3" <<'EOF'
import sys, shutil, os
from huggingface_hub import hf_hub_download
repo, name, dest = sys.argv[1:]
p = hf_hub_download(repo, name, local_dir="/workspace/_dl")
os.makedirs(os.path.dirname(dest), exist_ok=True)
shutil.move(p, dest)
EOF
  fi
}
get Comfy-Org/Qwen-Image-Edit_ComfyUI split_files/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors $M/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors
get Comfy-Org/Qwen-Image_ComfyUI split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors $M/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors
get Comfy-Org/Qwen-Image_ComfyUI split_files/vae/qwen_image_vae.safetensors $M/vae/qwen_image_vae.safetensors
get Kim2091/UltraSharp 4x-UltraSharp.safetensors $M/upscale_models/4x-UltraSharp.safetensors
rm -rf $W/_dl

echo "starting ComfyUI"
nohup python main.py --listen 127.0.0.1 --port 8188 > $W/comfyui.log 2>&1 &
for i in $(seq 1 60); do curl -s 127.0.0.1:8188/system_stats >/dev/null && break; sleep 5; done

echo "starting worker"
cd $W
export TANTU_TOKEN_FILE=$W/.tantu-token
echo -n "$TANTU_TOKEN" > $TANTU_TOKEN_FILE
export QWEN_UNET=qwen_image_edit_2511_fp8mixed.safetensors QWEN_CLIP=qwen_2.5_vl_7b_fp8_scaled.safetensors QWEN_LOADER=full
export COMFY_OUT=$W/ComfyUI/output WORKER_DIR=$W/worker WORKER_LOG=$W/tantu_worker.log UPSCALE_DIR=$M/upscale_models
exec python $W/tantu_worker.py
