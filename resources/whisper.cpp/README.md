# Whisper.cpp Binaries

This directory contains the whisper.cpp binaries and dynamic libraries used for local transcription.

## Directory Structure

```
whisper.cpp/
├── whisper-darwin-arm64     # macOS Apple Silicon binary (patched rpath)
├── libwhisper.1.dylib       # Whisper library
├── libwhisper.1.7.6.dylib   # Whisper library (versioned)
├── libggml.dylib            # GGML core library
├── libggml-base.dylib       # GGML base library
├── libggml-cpu.dylib        # GGML CPU backend
├── libggml-blas.dylib       # GGML BLAS backend
├── libggml-metal.dylib      # GGML Metal backend (GPU)
├── models/                  # Downloaded models (created at runtime)
└── README.md                # This file
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

- `ggml-tiny.bin` (75MB) - Fastest, good for real-time
- `ggml-base.bin` (142MB) - Balanced speed/accuracy
- `ggml-small.bin` (466MB) - Higher accuracy
- `ggml-medium.bin` (1.5GB) - Best accuracy

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

## Important: Dynamic Library Loading (macOS)

The whisper binary has been **patched** to load libraries from `@executable_path` (same directory).

**DO NOT** replace `whisper-darwin-arm64` without updating its rpath:

```bash
install_name_tool -add_rpath "@executable_path" whisper-darwin-arm64
install_name_tool -change "@rpath/libwhisper.1.dylib" "@executable_path/libwhisper.1.dylib" whisper-darwin-arm64
install_name_tool -change "@rpath/libggml.dylib" "@executable_path/libggml.dylib" whisper-darwin-arm64
install_name_tool -change "@rpath/libggml-cpu.dylib" "@executable_path/libggml-cpu.dylib" whisper-darwin-arm64
install_name_tool -change "@rpath/libggml-blas.dylib" "@executable_path/libggml-blas.dylib" whisper-darwin-arm64
install_name_tool -change "@rpath/libggml-metal.dylib" "@executable_path/libggml-metal.dylib" whisper-darwin-arm64
install_name_tool -change "@rpath/libggml-base.dylib" "@executable_path/libggml-base.dylib" whisper-darwin-arm64
```

Verify the binary's library dependencies:

```bash
otool -L whisper-darwin-arm64
```

Should show `@executable_path/` for all whisper/ggml libraries.

## Code Signing (Production Builds)

All `.dylib` files and the binary are automatically code-signed during production builds via `code-signing/sign-dylibs.js`.

For local unsigned builds, set `SKIP_NOTARIZE=true` to skip signing.

## Notes

- Binaries must be executable (`chmod +x`)
- All dylibs must be present in the same directory as the binary
- Models are downloaded from HuggingFace on first use
- Temporary audio files are created in system temp directory
- All processing is done locally without network dependencies
