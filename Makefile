# TODO: Generalize targets for WebWorker target. Support sharing certain files
# across the wire.
COFFEEC   := $(shell npm bin)/coffee
UGLIFYJS  := $(shell npm bin)/uglifyjs
CODO      := $(shell npm bin)/codo

TESTFILES := $(wildcard test/*/*.js)
TESTS     := $(TESTFILES:.js=.test)

SRCS      := $(wildcard src/main/*.coffee)
BINS      := $(SRCS:src/main/%.coffee=tmp/%.js)

.PHONY: dependencies release dev test doc clean

release: lib/browserfs.min.js
dev: lib/browserfs.js
test: release $(TESTS)
doc:
	$(CODO) --title "BrowserFS Documentation" src

clean:
	@rm -f lib/*.js lib/*.map
	@rm -rf tmp/

dependencies:
	@npm install

test/node/%.test: test/node/%.js
	node $^ > /dev/null

tmp/%.js: src/main/%.coffee
	node $(COFFEEC) --output tmp --compile $^

lib/browserfs.js: $(BINS)
	node $(COFFEEC) -m --output tmp --compile --join browserfs.js src/main/*.coffee
	node $(UGLIFYJS) -b --output lib/browserfs.js --in-source-map tmp/browserfs.map --source-map lib/browserfs.map vendor/*.js tmp/browserfs.js

lib/browserfs.min.js: lib/browserfs.js
	node $(UGLIFYJS) --compress unused=false --output lib/browserfs.min.js --in-source-map tmp/browserfs.map --source-map lib/browserfs.min.map vendor/*.js lib/browserfs.js
