#!/bin/bash
rpmbuild -bb --define "main $(pwd)" --define '_topdir %{main}/build/rpmbuild' --define "_version ${VERSION}" --define "_release ${RELEASE}" build/bigip-blue-green.spec
pushd build/rpmbuild/RPMS/noarch
sha256sum ${RPM_NAME} > ${RPM_NAME}.sha256
popd