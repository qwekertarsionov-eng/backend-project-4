install:
	npm ci

test:
	node --experimental-vm-modules node_modules/jest/bin/jest.js

lint:
	npx eslint .
