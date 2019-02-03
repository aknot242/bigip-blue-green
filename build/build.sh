#!/bin/bash
docker build -t bigip-blue-green-build -f build/Dockerfile .
docker run -v $(pwd):/home/ --workdir /home --name bg_build --rm bigip-blue-green-build build/buildAll.sh