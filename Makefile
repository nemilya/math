# Lumo — Sky of Questions: a static site with no build step (README.md).
# make is only needed to preview locally, check the lines, voice them, and build the hosting folder.
-include local.mk
export OPENROUTER_API_KEY OPENROUTER_PROXY

LANGS ?=

.PHONY: help serve check voice dist

help:  ## list targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*## /\t/'

serve:  ## the portal locally: http://localhost:8000
	node tools/serve.mjs 8000

check:  ## lines: every language and age version present; scripts only use lines that exist
	node tools/lines.mjs check

voice:  ## voice new and changed lines (Gemini TTS via OpenRouter) → web/audio/  (LANGS="en ru")
	node tools/voice.mjs $(LANGS)

dist: check  ## folder for hosting: dist/ and dist.zip (upload to any subfolder)
	node tools/dist.mjs
