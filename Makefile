COFFEE    := $(shell npm bin)/coffee
UGLIFYJS  := $(shell npm bin)/uglifyjs
CODO      := $(shell npm bin)/codo
KARMA     := $(shell npm bin)/karma

S2B = $($(1):src/$(2)/%.coffee=tmp/$(2)/%.js)

SRCS_CORE := $(wildcard src/core/*.coffee)
SRCS_GEN  := $(wildcard src/generic/*.coffee)
SRCS_BND  := $(wildcard src/backend/*.coffee)
# Order matters!
SRCS      := $(SRCS_CORE) $(SRCS_GEN) $(SRCS_BND)
BINS      := $(call S2B,SRCS_CORE,core) $(call S2B,SRCS_GEN,generic) \
             $(call S2B,SRCS_BND,backend)
FIXTURES  := $(shell find test/fixtures -name '*')

.PHONY: dependencies release dev test doc clean

release: lib/browserfs.min.js
dev: lib/browserfs.js
test: $(KARMA) lib/load_fixtures.js
	$(KARMA) start
doc: doc/index.html
clean:
	@rm -f lib/*.js lib/*.map
	@rm -rf tmp/
dependencies: $(COFFEE) $(UGLIFYJS) $(CODO) $(KARMA)

doc/index.html: $(SRCS) $(CODO) README.md
	$(CODO) --title "BrowserFS Documentation" $(SRCS)

$(COFFEE) $(UGLIFYJS) $(CODO) (KARMA):
	@echo "Installing needed Node modules with 'npm install'..."
	@npm install
	@echo "Node modules installed successfully!"

tmp/%.js: src/%.coffee $(COFFEE)
	$(COFFEE) --output $(shell dirname $@) --compile $<

lib/browserfs.js: $(BINS) $(COFFEE) $(UGLIFYJS)
	$(COFFEE) -m --output tmp --compile --join browserfs.js $(SRCS)
	$(UGLIFYJS) -b --output lib/browserfs.js --in-source-map tmp/browserfs.map --source-map lib/browserfs.map vendor/*.js tmp/browserfs.js

lib/browserfs.min.js: lib/browserfs.js $(UGLIFYJS)
	$(UGLIFYJS) --compress unused=false --output $@ --in-source-map tmp/browserfs.map --source-map lib/browserfs.min.map vendor/*.js lib/browserfs.js

lib/load_fixtures.js: tools/FixtureLoaderMaker.coffee $(COFFEE) $(FIXTURES)
	$(COFFEE) $<
