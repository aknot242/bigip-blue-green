#!/bin/bash
VERSION=$(npm version | grep bigip-blue-green | cut -d : -f 2 | awk -F \' '{print $2}')
RELEASE=3
RPM_NAME=bigip-blue-green-${VERSION}-${RELEASE}.noarch.rpm
rm -rf node_modules
npm install --production
rpmbuild -bb --define "main $(pwd)" --define '_topdir %{main}/build/rpmbuild' --define "_version ${VERSION}" --define "_release ${RELEASE}" build/bigip-blue-green.spec
pushd build/rpmbuild/RPMS/noarch
sha256sum ${RPM_NAME} > ${RPM_NAME}.sha256
popd