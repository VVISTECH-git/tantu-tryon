#!/usr/bin/env bash
# Train a LoRA for Qwen-Image-Edit-2511 on Tantu's garment pairs (8 Oct), on a rented 80 GB GPU.
# Needs: DATASET_URL (signed link to <name>.tar.gz), DATASET_NAME, UPLOAD_URL (signed PUT for the LoRA),
# EPOCHS (default 3). Progress in /workspace/train.log; the LoRA files in /workspace/lora/.
set -euo pipefail
W=/workspace
LOG=$W/train.log
exec > >(tee -a "$LOG") 2>&1
echo "== $(date) training setup"
cd $W
if [ ! -d DiffSynth-Studio ]; then
  git clone -q https://github.com/modelscope/DiffSynth-Studio.git
  cd DiffSynth-Studio && pip install -q -e . 2>&1 | tail -1 && pip install -q modelscope accelerate 2>&1 | tail -1 && cd ..
fi
if [ ! -d data/$DATASET_NAME ]; then
  mkdir -p data && curl -fsSL "$DATASET_URL" -o data/set.tar.gz && tar -xzf data/set.tar.gz -C data && rm data/set.tar.gz
fi
PAIRS=$(python -c "import json;print(len(json.load(open('data/$DATASET_NAME/metadata.json'))))")
echo "pairs: $PAIRS"
cd DiffSynth-Studio
# Models come from ModelScope the first time (about 60 GB) and stay on the volume.
export MODELSCOPE_CACHE=$W/models
accelerate launch examples/qwen_image/model_training/train.py \
  --dataset_base_path ../data/$DATASET_NAME \
  --dataset_metadata_path ../data/$DATASET_NAME/metadata.json \
  --data_file_keys "image,edit_image" \
  --extra_inputs "edit_image" \
  --max_pixels 1048576 \
  --dataset_repeat 1 \
  --model_id_with_origin_paths "Qwen/Qwen-Image-Edit-2511:transformer/diffusion_pytorch_model*.safetensors,Qwen/Qwen-Image:text_encoder/model*.safetensors,Qwen/Qwen-Image:vae/diffusion_pytorch_model.safetensors" \
  --learning_rate 1e-4 \
  --num_epochs ${EPOCHS:-3} \
  --remove_prefix_in_ckpt "pipe.dit." \
  --output_path "$W/lora" \
  --lora_base_model "dit" \
  --lora_target_modules "to_q,to_k,to_v,add_q_proj,add_k_proj,add_v_proj,to_out.0,to_add_out,img_mlp.net.2,img_mod.1,txt_mlp.net.2,txt_mod.1" \
  --lora_rank 32 \
  --use_gradient_checkpointing \
  --dataset_num_workers 4 \
  --find_unused_parameters \
  --zero_cond_t
echo "== $(date) training done"
ls -la $W/lora
LAST=$(ls -t $W/lora/*.safetensors | head -1)
if [ -n "${UPLOAD_URL:-}" ]; then
  curl -fsS -X PUT -H "Content-Type: application/octet-stream" --data-binary @"$LAST" "$UPLOAD_URL" && echo "LoRA uploaded"
fi
echo "== $(date) all done"
sleep infinity
