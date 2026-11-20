.PHONY: all clean cleanassets init lint firefox

sources := ./dist/version $(shell find ./assets -type f) $(shell find ./src -type f)
platform := $(wildcard platform/*/*)
assets := dist/build/uAssets

all: firefox

dist/build/uBlock0.firefox: tools/make-firefox.sh $(sources) $(platform) $(assets)
	tools/make-firefox.sh all

# Build the extension for Firefox 160+.
firefox: dist/build/uBlock0.firefox

dist/build/uAssets:
	tools/pull-assets.sh

node_modules:
	npm install

init: node_modules

lint: init
	npm run lint

clean:
	rm -rf dist/build tmp/node_modules node_modules

cleanassets:
	rm -rf dist/build/uAssets
