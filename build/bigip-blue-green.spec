Summary: BIG-IP BlueGreen Deployment iControlLX extension
Name: bigip-blue-green
Version: %{_version}
Release: %{_release}
BuildArch: noarch
Group: Development/Tools
License: Commercial
Packager: F5 Networks <support@f5.com>

%description
BlueGreen deployment controller for BIG-IP

%global __os_install_post %{nil}

%define _rpmfilename %%{ARCH}/%%{NAME}-%%{VERSION}-%%{RELEASE}.%%{ARCH}.rpm
%define IAPP_INSTALL_DIR /var/config/rest/iapps/%{name}

%prep
rm -rf %{_builddir}/*
cp %{main}/api/manifest.json %{_builddir}
cp %{main}/api/package.json %{_builddir}
cp -r %{main}/api/nodejs %{_builddir}
cp -r %{main}/api/node_modules %{_builddir}/nodejs
cp -r %{main}/ui/dist/bigip-blue-green %{_builddir}/presentation

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}
cp %{_builddir}/manifest.json $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}
cp %{_builddir}/package.json $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}
cp -r %{_builddir}/nodejs $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}
cp -r %{_builddir}/presentation $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root)
%{IAPP_INSTALL_DIR}
