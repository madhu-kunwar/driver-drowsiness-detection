# Model Training Notes

## Dataset
- Using driver drowsiness dataset from Kaggle
- ~2400 images across categories: drowsy, alert, yawning
- Augmented with random brightness, rotation, and flipping

## Model Architecture
- Base: MobileNetV2 (pretrained on ImageNet)
- Fine-tuned last 30 layers
- Added global average pooling + dense layers
- Output: 3 classes (alert, drowsy, distracted)

## Training Config
- Optimizer: Adam (lr=0.0001)
- Batch size: 32
- Epochs: 50 with early stopping (patience=5)
- Loss: Categorical crossentropy

## Results
- Training accuracy: ~95%
- Validation accuracy: ~92%
- Best model saved at epoch 38

## Next Steps
- Test on real-time webcam feed
- Optimize model size for faster inference
- Consider TFLite conversion for edge deployment
