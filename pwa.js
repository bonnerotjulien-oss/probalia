const installButton=document.getElementById('install');
const help=document.getElementById('install-help');
const helpText=document.getElementById('install-instructions');
let deferredInstall=null;
const isStandalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
if(isStandalone)installButton.hidden=true;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event});
installButton.addEventListener('click',async()=>{
  if(deferredInstall){await deferredInstall.prompt();deferredInstall=null;return}
  const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  if(isiOS)helpText.textContent='Dans Safari : touche le bouton Partager, puis « Sur l’écran d’accueil », active l’ouverture comme app si cette option est proposée et confirme « Ajouter ». Un lien HTTPS est nécessaire.';
  else helpText.textContent='Depuis le menu de ton navigateur, choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ». L’installation nécessite d’abord un hébergement HTTPS.';
  help.showModal();
});
window.addEventListener('appinstalled',()=>installButton.hidden=true);
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
