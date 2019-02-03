#!/bin/bash
pushd api
export VERSION=$(npm version | grep bigip-blue-green | cut -d : -f 2 | awk -F \' '{print $2}')
export RELEASE=0001
export RPM_NAME=bigip-blue-green-${VERSION}-${RELEASE}.noarch.rpm
rm -rf node_modules
npm install --production
popd
