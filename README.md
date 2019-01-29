## RPM Build Steps ##
```

docker build -t bigip-blue-green-build .
cd ui
npm run build-prod
docker run -v $(pwd):/home/ -it --name bg_build --rm bigip-blue-green-build
docker exec -it bg_build /bin/bash
cd /home
 ./build/buildRpm.sh

 ```