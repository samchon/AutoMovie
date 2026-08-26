# Audio

Place declared stems here. Audio timeline and final mux remain explicit production work; no provider call is hidden in MCP. Register every stem's byte-exact source, license, processing, and use in `automovie/assets.json`.

A stem the render decodes and mixes is a RIFF/WAVE (`*.wav`) file carrying 16-bit PCM or 32-bit IEEE float samples, mono or stereo; it is folded to mono and resampled to 48 kHz when its own rate differs. Any other container is refused by name at render time rather than mixed as silence. A tracked `*.json` duration descriptor is not a stem and mixes no sound; use one only as an explicit timeline placeholder owned by the production.
