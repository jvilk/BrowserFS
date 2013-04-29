# TODO: Generalize targets for WebWorker target. Support sharing certain files
# across the wire.
COFFEEC   := $(shell npm bin)/coffee
UGLIFYJS  := $(shell npm bin)/uglifyjs

TESTFILES := $(wildcard test/*/*.js)
TESTS     := $(SOURCES:.js=.test)

.PHONY: dependencies release dev test

# Installs or checks for any required dependencies.
dependencies:
	@npm install

release: lib/browserfs.min.js
dev: lib/browserfs.js
test: $(TESTS)

test/node/%.test: test/node/%.js
	node $^

tmp/%.js: src/main/%.coffee
	node $(COFFEEC) --output tmp --compile $^

lib/browserfs.js:
	node $(COFFEEC) --output lib --compile --join browserfs.js src/main/*.coffee
	node $(UGLIFYJS) -b --output lib/browserfs.js vendor/*.js lib/browserfs.js

lib/browserfs.min.js: lib/browserfs.js
	node $(UGLIFYJS) --compress unused=false --output lib/browserfs.min.js --source-map lib/browserfs.min.map vendor/*.js lib/browserfs.js
