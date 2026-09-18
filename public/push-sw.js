self.addEventListener("push",(event)=>{
  let payload={title:"Cash Engine PRO",body:"Você recebeu uma nova notificação.",url:"/app"};
  try{
    if(event.data){
      payload={...payload,...event.data.json()};
    }
  }catch{}
  event.waitUntil(
    self.registration.showNotification(payload.title,{
      body:payload.body,
      icon:"/favicon.ico",
      badge:"/favicon.ico",
      data:{url:payload.url||"/app"},
    })
  );
});

self.addEventListener("notificationclick",(event)=>{
  event.notification.close();
  const url=event.notification?.data?.url||"/app";
  event.waitUntil(
    clients.matchAll({type:"window",includeUncontrolled:true}).then((windows)=>{
      for(const client of windows){
        if("focus" in client){
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
