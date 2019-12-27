#DSK=/c/Users/duot/Projects/Atelier-SLX/Gitlab/gitlab-ldap-sync
#DSK=/opt/gitlab-ldap-sync
DSK=$PWD
ACT_DSK="-v $DSK/actions:/app/actions"
CFG_DSK="-v $DSK/config:/app/config"
LOG_DSK="-v $DSK/log:/app/log"

docker run -it $ACT_DSK $CFG_DSK $LOG_DSK  -p 8000:80 gitlab-ldap-group-sync $1 
