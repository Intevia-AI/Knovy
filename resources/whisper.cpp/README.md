# Whisper.cpp Binaries

This directory contains the whisper.cpp binaries and dynamic libraries used for local transcription.

## Directory Structure

Current version: **v1.9.1** (ggml 0.15.1).

```
whisper.cpp/
├── whisper-darwin-arm64        # macOS Apple Silicon CLI binary (patched rpath)
├── whisper-server-darwin-arm64 # macOS Apple Silicon HTTP server (patched rpath)
├── libwhisper.1.dylib       # Whisper library
├── libggml.0.dylib          # GGML core library
├── libggml-base.0.dylib     # GGML base library
├── libggml-cpu.0.dylib      # GGML CPU backend
├── libggml-blas.0.dylib     # GGML BLAS backend
├── libggml-metal.0.dylib    # GGML Metal backend (GPU)
├── models/                  # Downloaded models (created at runtime)
└── README.md                # This file
```

All dylibs are **real files, not symlinks** (the release zip flattens symlinks, which
breaks Squirrel auto-updates). Each is the real library copied under the exact name the
binaries reference via `@rpath` (e.g. `libggml.0.15.1.dylib` → `libggml.0.dylib`).

## Binary Requirements

The binaries are compiled from [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
at the tag noted above:

### Build Commands (macOS arm64)

```bash
git clone --depth 1 --branch v1.9.1 https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DBUILD_SHARED_LIBS=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build -j --target whisper-cli whisper-server
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

Both binaries are **patched** to resolve their `@rpath` libraries from the same
directory. After building, strip the build-tree rpaths and add `@executable_path`:

```bash
for b in whisper-darwin-arm64 whisper-server-darwin-arm64; do
  otool -l "$b" | grep -A2 LC_RPATH | grep ' path ' | awk '{print $2}' |
    while read rp; do install_name_tool -delete_rpath "$rp" "$b"; done
  install_name_tool -add_rpath "@executable_path" "$b"
  codesign --force --sign - "$b"   # ad-hoc re-sign after patching
done
```

Verify with `otool -L whisper-darwin-arm64` — all whisper/ggml entries stay
`@rpath/...` and resolve via the `@executable_path` rpath. Copy the dylibs as real
files named exactly as referenced (see the note in Directory Structure).

## whisper-server (persistent HTTP server)

`whisper-server-darwin-arm64` is whisper.cpp's bundled `examples/server` built from the
same tag as the CLI binary and dylibs. It loads the model **once** and serves
`POST /inference` over localhost, eliminating the ~0.5–1s model reload that the CLI pays
on every audio segment. `WhisperBackend` spawns it lazily and falls back to the CLI
binary automatically if it fails.

Started with
`--model <ggml>.bin --host 127.0.0.1 --port <free> --vad-model <silero>.bin`; the VAD
model and the transcription model are bound at startup, everything else (language,
prompt, temperature, beam size, per-request VAD toggle/thresholds, `response_format`)
is sent per request.

## Code Signing (Production Builds)

All `.dylib` files and the binary are automatically code-signed during production builds via `code-signing/sign-dylibs.js`.

For local unsigned builds, set `SKIP_NOTARIZE=true` to skip signing.

## Notes

- Binaries must be executable (`chmod +x`)
- All dylibs must be present in the same directory as the binary
- Models are downloaded from HuggingFace on first use
- Temporary audio files are created in system temp directory
- All processing is done locally without network dependencies
