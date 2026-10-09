#!/usr/bin/env bash
# Tantu's full Qwen worker on a rented 80 GB GPU (9 Oct): the full-precision Qwen-Image-Edit-2511 in
# DiffSynth (no ComfyUI), our LoRAs per garment type, then the worker that serves the website's queue.
# Models stay on the pod's volume, so a restart does not download them again.
set -uo pipefail
W=/workspace
LOG=$W/setup.log
exec > >(tee -a "$LOG") 2>&1
echo "== $(date) full Qwen setup on $(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader)"
cd $W
export DIFFSYNTH_DOWNLOAD_SOURCE=huggingface DIFFSYNTH_MODEL_BASE_PATH=$W/models HF_HUB_ENABLE_HF_TRANSFER=1
if [ ! -d DiffSynth-Studio ]; then
  git clone -q https://github.com/modelscope/DiffSynth-Studio.git
fi
(cd DiffSynth-Studio && pip install -q -e . 2>&1 | tail -1 && pip install -q modelscope accelerate hf_transfer 2>&1 | tail -1)

echo "starting the worker"
export TANTU_TOKEN_FILE=$W/.tantu-token
echo -n "$TANTU_TOKEN" > $TANTU_TOKEN_FILE
export QWEN_ENGINE=full LORA_DIR=$W/loras WORKER_DIR=$W/worker WORKER_LOG=$W/tantu_worker.log
cd $W/DiffSynth-Studio
exec python $W/tantu_worker.py
