USER=""
PASS=""
SERVER=""
# echo $USER $PASS
sshpass -p $PASS scp $2 $USER@$SERVER:/var/config/rest/iapps/bigip-blue-green/nodejs/
ssh $USER@$SERVER "bigstart restart restnoded"
