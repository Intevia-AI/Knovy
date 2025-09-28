# Whisper.cpp Binaries

This directory contains the whisper.cpp binaries used for local transcription.

## Directory Structure

```
whisper.cpp/
├── whisper-darwin-x64       # macOS Intel binary
├── whisper-darwin-arm64     # macOS Apple Silicon binary
├── whisper-win32-x64.exe    # Windows x64 binary
├── whisper-linux-x64        # Linux x64 binary
├── models/                  # Downloaded models (created at runtime)
└── README.md               # This file
```

## Binary Requirements

The binaries should be compiled from [whisper.cpp](https://github.com/ggerganov/whisper.cpp) with the following configuration:

### Build Commands

**macOS (Universal Binary):**
```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make clean
make -j4

# For ARM64 specifically:
arch -arm64 make clean
arch -arm64 make -j4

# For x64 specifically:
arch -x86_64 make clean
arch -x86_64 make -j4
```

**Windows:**
```bash
mkdir build
cd build
cmake ..
cmake --build . --config Release
```

**Linux:**
```bash
make clean
make -j4
```

## Model Downloads

Models are automatically downloaded to the user data directory at runtime:
- **macOS**: `~/Library/Application Support/Knovy/whisper-models/`
- **Windows**: `%APPDATA%/Knovy/whisper-models/`
- **Linux**: `~/.config/Knovy/whisper-models/`

Available models:
- `ggml-tiny.bin` (39MB) - Fastest, good for real-time
- `ggml-base.bin` (74MB) - Balanced speed/accuracy
- `ggml-small.bin` (244MB) - Higher accuracy
- `ggml-medium.bin` (769MB) - Best accuracy

## Usage

The binaries are executed by the LocalTranscriptionService with these parameters:

```bash
./whisper-darwin-arm64 input.wav \
  --model ./models/ggml-tiny.bin \
  --output-format text \
  --no-timestamps \
  --threads 4 \
  --language auto
```

## Notes

- Binaries must be executable (`chmod +x`)
- Models are downloaded from HuggingFace on first use
- Temporary audio files are created in system temp directory
- All processing is done locally without network dependencies