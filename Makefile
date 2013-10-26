COFFEE    := $(shell npm bin)/coffee
TSC       := $(shell npm bin)/tsc
RJS       := $(shell npm bin)/r.js
CODO      := $(shell npm bin)/codo
KARMA     := $(shell npm bin)/karma
GRUNT     := $(shell npm bin)/grunt
BOWER     := $(shell npm bin)/bower
# Convenience for expressing dependencies.
NPM_MODS  := $(COFFEE) $(TSC) $(RJS) $(CODO) $(KARMA) $(GRUNT) $(BOWER)
# Bower dependencies.
BOW_DEPS  := vendor/async/lib/async.js vendor/dropbox-build/dropbox.js \
             vendor/DefinitelyTyped/README.md

S2B = $($(1):src/$(2)/%.ts=tmp/$(2)/%.js)

SRCS_CORE := $(wildcard src/core/*.ts)
SRCS_GEN  := $(wildcard src/generic/*.ts)
SRCS_BND  := $(wildcard src/backend/*.ts)
SRCS      := $(SRCS_CORE) $(SRCS_GEN) $(SRCS_BND)
BINS      := $(call S2B,SRCS_CORE,core) $(call S2B,SRCS_GEN,generic) \
             $(call S2B,SRCS_BND,backend)
FIXTURES  := $(shell find test/fixtures -name '*')

.PHONY: dependencies release dev test doc clean dropbox_tokens

release: lib/browserfs.js
dev: $(BINS)

dropbox_test: dropbox_tokens test

test: dev $(GRUNT) $(KARMA) listings.json lib/load_fixtures.js \
	vendor/async/lib/async.js vendor/dropbox-build/dropbox.js
	$(GRUNT)
doc: doc/index.html
clean:
	@rm -f lib/*.js lib/*.map
	@rm -rf tmp/
	@rm -rf test/dropbox
dependencies: $(NPM_MODS) $(BOW_DEPS)

doc/index.html: $(SRCS) $(CODO) README.md
	# TODO: Use JSDoc.
	#$(CODO) --title "BrowserFS Documentation" $(SRCS)

$(NPM_MODS):
	@echo "Installing needed Node modules with 'npm install'..."
	@npm install
	@echo "Node modules installed successfully!"

$(BOW_DEPS): $(BOWER)
	$(BOWER) install

listings.json: tools/XHRIndexer.coffee $(FIXTURES)
	$(COFFEE) tools/XHRIndexer.coffee > listings.json

# Release build
lib/browserfs.js: $(BINS) $(RJS)
	$(RJS) -o build.js

watch:
	$(TSC) -w --outDir tmp --module amd --sourcemap $(SRCS)

# Development build
$(BINS): $(SRCS) $(TSC)
	$(TSC) --outDir tmp --module amd --sourcemap $(SRCS)

lib/load_fixtures.js: tools/FixtureLoaderMaker.coffee $(COFFEE) $(FIXTURES)
	$(COFFEE) $<

test/dropbox/cert.pem:
	mkdir -p test/dropbox
	openssl req -new -x509 -days 365 -nodes -batch -out test/dropbox/cert.pem -keyout test/dropbox/cert.pem -subj /O=dropbox.js/OU=Testing/CN=localhost

dropbox_tokens: test/dropbox/cert.pem $(COFFEE)
	$(COFFEE) tools/get_db_credentials.coffee
