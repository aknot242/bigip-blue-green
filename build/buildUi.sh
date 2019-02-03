#!/bin/bash
pushd ui
npm install -g @angular/cli
npm run build-prod
popd
