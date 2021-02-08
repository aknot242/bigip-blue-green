#!/bin/bash
pushd ui
npm install -g @angular/cli
npm install
npm run build-prod
popd
