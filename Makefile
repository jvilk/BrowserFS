COFFEE    := $(shell npm bin)/coffee
UGLIFYJS  := $(shell npm bin)/uglifyjs
CODO      := $(shell npm bin)/codo
KARMA     := $(shell npm bin)/karma
GRUNT     := $(shell npm bin)/grunt
BOWER     := $(shell npm bin)/bower

S2B = $($(1):src/$(2)/%.coffee=tmp/$(2)/%.js)

#From Make 3.82 onwards, wildcard returns filenames in arbitrary order.
#Alphabetically sorting the values is sufficient for browserfs build dependencies.
SRCS_CORE_UNSORTED := $(wildcard src/core/*.coffee)
SRCS_CORE := $(sort $(SRCS_CORE_UNSORTED))

SRCS_GEN  := $(wildcard src/generic/*.coffee)
SRCS_BND  := $(wildcard src/backend/*.coffee)
# Order matters!
SRCS      := $(SRCS_CORE) $(SRCS_GEN) $(SRCS_BND)
BINS      := $(call S2B,SRCS_CORE,core) $(call S2B,SRCS_GEN,generic) \
             $(call S2B,SRCS_BND,backend)
FIXTURES  := $(shell find test/fixtures -name '*')

.PHONY: dependencies release dev test doc clean dropbox_tokens

release: lib/browserfs.min.js
dev: lib/browserfs.js

test: $(GRUNT) $(KARMA) listings.json lib/load_fixtures.js \
	vendor/async/lib/async.js vendor/dropbox-build/dropbox.js \
	dropbox_tokens
	$(GRUNT)
doc: doc/index.html
clean:
	@rm -f lib/*.js lib/*.map
	@rm -rf tmp/
	@rm -rf test/dropbox
dependencies: $(COFFEE) $(UGLIFYJS) $(CODO) $(KARMA)

doc/index.html: $(SRCS) $(CODO) README.md
	$(CODO) --title "BrowserFS Documentation" $(SRCS)

$(COFFEE) $(UGLIFYJS) $(CODO) (KARMA) $(GRUNT):
	@echo "Installing needed Node modules with 'npm install'..."
	@npm install
	@echo "Node modules installed successfully!"

listings.json: tools/XHRIndexer.coffee $(FIXTURES)
	$(COFFEE) tools/XHRIndexer.coffee > listings.json

tmp/%.js: src/%.coffee $(COFFEE)
	$(COFFEE) --output $(shell dirname $@) --compile $<

lib/browserfs.js: $(BINS) $(COFFEE) $(UGLIFYJS)
	$(COFFEE) -m --output tmp --compile --join browserfs.js $(SRCS)
	$(UGLIFYJS) -b --output lib/browserfs.js --in-source-map tmp/browserfs.map --source-map lib/browserfs.map vendor/*.js tmp/browserfs.js

lib/browserfs.min.js: lib/browserfs.js $(UGLIFYJS)
	$(UGLIFYJS) --compress unused=false --output $@ --in-source-map tmp/browserfs.map --source-map lib/browserfs.min.map vendor/*.js lib/browserfs.js

lib/load_fixtures.js: tools/FixtureLoaderMaker.coffee $(COFFEE) $(FIXTURES)
	$(COFFEE) $<

vendor/async/lib/async.js vendor/dropbox-build/dropbox.js: $(BOWER)
	bower install

test/dropbox/cert.pem:
	mkdir -p test/dropbox
	openssl req -new -x509 -days 365 -nodes -batch -out test/dropbox/cert.pem -keyout test/dropbox/cert.pem -subj /O=dropbox.js/OU=Testing/CN=localhost

dropbox_tokens: test/dropbox/cert.pem $(COFFEE)
	$(COFFEE) tools/get_db_credentials.coffee
