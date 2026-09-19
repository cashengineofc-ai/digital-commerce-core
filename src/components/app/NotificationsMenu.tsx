import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, Loader2, Settings2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Notice = {
  id:string;
  tipo:string;
  titulo:string;
  mensagem:string;
  url_destino:string|null;
  lida:boolean;
  created_at:string;
  total_registros:number;
  total_nao_lidas:number;
};

type Preference = {
  tipo:string;
  receber_inapp:boolean;
  receber_email:boolean;
  receber_push:boolean;
};

type Channels = {inapp:boolean;email:boolean;push:boolean};

function getDeviceId(){
  const key="ce-push-device-id";
  let value=window.localStorage.getItem(key);
  if(!value){
    value=crypto.randomUUID();
    window.localStorage.setItem(key,value);
  }
  return value;
}

function vapidKey(value:string){
  const padding="=".repeat((4-(value.length%4))%4);
  const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=window.atob(base64);
  return Uint8Array.from([...raw].map((char)=>char.charCodeAt(0)));
}

export function NotificationsMenu(){
  const navigate=useNavigate();
  const [open,setOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [rows,setRows]=useState<Notice[]>([]);
  const [preferences,setPreferences]=useState<Preference[]>([]);
  const [channels,setChannels]=useState<Channels>({inapp:true,email:false,push:false});
  const [loading,setLoading]=useState(false);
  const [acting,setActing]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    setError(null);
    try{
      const [noticeResult,channelResult]=await Promise.all([
        (supabase as any).rpc("fn_notificacoes_me",{p_limit:30,p_offset:0}),
        (supabase as any).rpc("fn_notificacao_canais_status"),
      ]);
      if(noticeResult.error) throw noticeResult.error;
      if(channelResult.error) throw channelResult.error;
      setRows(((noticeResult.data??[]) as any[]).map((row)=>({
        id:String(row.id),
        tipo:String(row.tipo),
        titulo:String(row.titulo),
        mensagem:String(row.mensagem),
        url_destino:row.url_destino?String(row.url_destino):null,
        lida:Boolean(row.lida),
        created_at:String(row.created_at),
        total_registros:Number(row.total_registros??0),
        total_nao_lidas:Number(row.total_nao_lidas??0),
      })));
      setChannels({
        inapp:true,
        email:Boolean(channelResult.data?.email),
        push:Boolean(channelResult.data?.push),
      });
    }catch(cause:any){
      setError(cause?.message??"Não foi possível carregar notificações.");
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return()=>window.clearInterval(timer);
  },[load]);

  const unread=rows.at(0)?.total_nao_lidas??0;
  const publicPushKey=String(import.meta.env["VITE_WEB_PUSH_PUBLIC_KEY"]??"").trim();
  const pushReady=channels.push&&Boolean(publicPushKey);

  async function openSettings(){
    setSettingsOpen(true);
    setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc(
      "fn_notificacao_preferencias_me",
    );
    if(rpcError){
      setError(rpcError.message);
      return;
    }
    setPreferences(((data??[]) as any[]).map((row)=>({
      tipo:String(row.tipo),
      receber_inapp:Boolean(row.receber_inapp),
      receber_email:Boolean(row.receber_email),
      receber_push:Boolean(row.receber_push),
    })));
  }

  async function markRead(row:Notice){
    if(!row.lida){
      const {error:rpcError}=await (supabase as any).rpc(
        "fn_notificacao_marcar_lida",{p_id:row.id},
      );
      if(!rpcError){
        setRows((current)=>{
          if (!current.some((item)=>item.id===row.id&&!item.lida)) return current;
          return current.map((item)=>({...item,lida:item.id===row.id?true:item.lida,total_nao_lidas:Math.max(0,item.total_nao_lidas-1)}));
        });
      } else {
        setError(rpcError.message);
      }
    }
    if(row.url_destino){
      if(row.url_destino.startsWith("/")&&!row.url_destino.startsWith("//")){
        setOpen(false);
        await navigate({to:row.url_destino as never});
      }
    }
  }

  async function markAll(){
    setActing(true);
    const {error:rpcError}=await (supabase as any).rpc(
      "fn_notificacoes_marcar_todas_lidas",
    );
    if(rpcError) setError(rpcError.message);
    else await load();
    setActing(false);
  }

  async function savePreference(pref:Preference){
    setActing(true);
    setError(null);
    const {error:rpcError}=await (supabase as any).rpc(
      "fn_notificacao_preferencia_salvar",
      {
        p_tipo:pref.tipo,
        p_inapp:pref.receber_inapp,
        p_email:pref.receber_email,
        p_push:pref.receber_push,
      },
    );
    if(rpcError) setError(rpcError.message);
    else setPreferences((current)=>current.map((item)=>item.tipo===pref.tipo?pref:item));
    setActing(false);
  }

  function updatePreference(type:string,patch:Partial<Preference>){
    if (acting) return;
    const pref=preferences.find((item)=>item.tipo===type);
    if(pref) void savePreference({...pref,...patch});
  }

  async function enableBrowserPush(){
    setActing(true);
    setError(null);
    try{
      if(!channels.push) throw new Error("Push ainda não está configurado no servidor.");
      const publicKey=publicPushKey;
      if(!publicKey) throw new Error("Chave pública Web Push ainda não foi configurada.");
      if(!("serviceWorker" in navigator)||!("PushManager" in window)){
        throw new Error("Este navegador não oferece suporte a Web Push.");
      }
      const permission=await Notification.requestPermission();
      if(permission!=="granted") throw new Error("Permissão de notificações não concedida.");

      const registration=await navigator.serviceWorker.register("/push-sw.js");
      const existing=await registration.pushManager.getSubscription();
      const subscription=existing??await registration.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:vapidKey(publicKey),
      });
      const json=subscription.toJSON();
      const {error:rpcError}=await (supabase as any).rpc(
        "fn_push_inscricao_registrar",
        {
          p_device_id:getDeviceId(),
          p_endpoint:json.endpoint??"",
          p_p256dh:json.keys?.["p256dh"]??"",
          p_auth:json.keys?.["auth"]??"",
          p_user_agent:navigator.userAgent,
        },
      );
      if(rpcError) throw rpcError;
      await load();
    }catch(cause:any){
      setError(cause?.message??"Não foi possível ativar o push.");
    }finally{
      setActing(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notificações"
        onClick={()=>{setOpen((value)=>!value); if(!open) void load();}}
        className="relative rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4"/>
        {unread>0&&(
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[9px] font-bold leading-4 text-destructive-foreground">
            {unread>99?"99+":unread}
          </span>
        )}
      </button>

      {open&&(
        <>
          <button className="fixed inset-0 z-30 cursor-default" onClick={()=>setOpen(false)} aria-label="Fechar notificações"/>
          <div className="absolute right-0 top-full z-40 mt-2 w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="font-semibold">Notificações</p>
                <p className="text-xs text-muted-foreground">{unread} não lida{unread===1?"":"s"}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={()=>void markAll()} disabled={acting||unread===0} className="rounded-md p-2 text-muted-foreground hover:bg-muted disabled:opacity-40" title="Marcar todas como lidas">
                  <CheckCheck className="h-4 w-4"/>
                </button>
                <button onClick={()=>void openSettings()} className="rounded-md p-2 text-muted-foreground hover:bg-muted" title="Preferências">
                  <Settings2 className="h-4 w-4"/>
                </button>
              </div>
            </div>
            {error&&<div className="border-b border-border px-4 py-2 text-xs text-destructive">{error}</div>}
            <div className="max-h-[60vh] overflow-y-auto">
              {loading&&rows.length===0?(
                <div className="grid place-items-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/></div>
              ):rows.length===0?(
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma notificação real.</div>
              ):rows.map((row)=>(
                <button
                  key={row.id}
                  onClick={()=>void markRead(row)}
                  className={cn("block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60",!row.lida&&"bg-primary/5")}
                >
                  <div className="flex items-start gap-2">
                    {!row.lida&&<span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"/>}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{row.titulo}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.mensagem}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(row.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {settingsOpen&&(
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Preferências de notificação</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  In-app funciona sempre. E-mail e push só podem ser ligados quando o servidor estiver configurado.
                </p>
              </div>
              <button onClick={()=>setSettingsOpen(false)} className="rounded-lg p-2 hover:bg-muted"><X className="h-4 w-4"/></button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700">In-app ativo</span>
              <span className={cn("rounded-full px-2 py-1",channels.email?"bg-emerald-500/10 text-emerald-700":"bg-muted text-muted-foreground")}>E-mail {channels.email?"configurado":"indisponível"}</span>
              <span className={cn("rounded-full px-2 py-1",channels.push?"bg-emerald-500/10 text-emerald-700":"bg-muted text-muted-foreground")}>Push {pushReady?"configurado":"indisponível"}</span>
            </div>

            {pushReady&&(
              <button
                onClick={()=>void enableBrowserPush()}
                disabled={acting}
                className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                Vincular este dispositivo ao push
              </button>
            )}

            {error&&<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
            <fieldset disabled={acting} className="mt-5 divide-y divide-border rounded-xl border border-border">
              {preferences.map((pref)=>(
                <div key={pref.tipo} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 text-sm">
                  <span className="capitalize">{pref.tipo.replaceAll("_"," ")}</span>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input type="checkbox" checked={pref.receber_inapp} onChange={(e)=>updatePreference(pref.tipo,{receber_inapp:e.target.checked})}/>
                    In-app
                  </label>
                  <label className={cn("flex items-center gap-1 text-xs text-muted-foreground",!channels.email&&"opacity-40")}>
                    <input type="checkbox" disabled={!channels.email} checked={pref.receber_email} onChange={(e)=>updatePreference(pref.tipo,{receber_email:e.target.checked})}/>
                    E-mail
                  </label>
                  <label className={cn("flex items-center gap-1 text-xs text-muted-foreground",!pushReady&&"opacity-40")}>
                    <input type="checkbox" disabled={!pushReady} checked={pref.receber_push} onChange={(e)=>updatePreference(pref.tipo,{receber_push:e.target.checked})}/>
                    Push
                  </label>
                </div>
              ))}
            </fieldset>
          </div>
        </div>
      )}
    </div>
  );
}
