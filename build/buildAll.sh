#!/bin/bash
. build/buildUi.sh
. build/buildApi.sh
echo building $RPM_NAME
. build/buildRpm.sh