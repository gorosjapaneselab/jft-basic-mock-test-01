import {createResultsClient} from './results-api-v23.js';
import {showResults} from './results-view-v23.js';
import {styleAction,installFullscreen,teacherMenu} from './teacher-actions-v23.js';
import {CLASSES_API_URL} from './portal-config-v23.js';
import {CLASS_ACCESS_KEY,createClassesClient,createBridgeTransport} from './classes-api-v23.js';
import {createSchedulesClient} from './schedules-api-v23.js';
import {showSchedules,legacyScheduleDrafts} from './schedules-view-v23.js';
import {showClasses} from './classes-view-v23.js';
import {TEACHER_KEY,route,legacyExamRoute,authenticate,isTeacher,createRepository,activeClasses} from './portal-model-v23.js';
const app=document.querySelector('#portal'),repository=createRepository(localStorage);
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(tag==='button')styleAction(n);return n;};
const link=(label,href)=>{const a=node('a',label);a.href=href;a.className='button';styleAction(a);return a;};
const action=(label,fn)=>{const b=node('button',label);b.type='button';b.onclick=fn;return b;};
const field=(label,name,type='text')=>{const wrap=node('label');wrap.className='field';const i=node('input');i.name=name;i.type=type;i.required=true;wrap.append(node('span',label),i);return wrap;};
function teacher(){try{const value=JSON.parse(sessionStorage.getItem(TEACHER_KEY)||'null');return isTeacher(value)?value:null;}catch{return null;}}
function error(message){const p=node('p',message);p.className='error';p.setAttribute('role','alert');app.prepend(p);}
let disposeResults=null;
let renderVersion=0,classClient=null,classTransport=null,classIdentity='',scheduleClient=null;
function clientFor(identity){const scope=identity.schoolId+':'+identity.teacherId;if(!classClient||classIdentity!==scope){classTransport?.dispose();classTransport=createBridgeTransport(CLASSES_API_URL);classIdentity=scope;scheduleClient=null;classClient=createClassesClient({identity,storage:localStorage,credential:()=>sessionStorage.getItem(CLASS_ACCESS_KEY+':'+scope)||'',transport:classTransport});}return classClient;}
function scheduleFor(identity){clientFor(identity);if(!scheduleClient)scheduleClient=createSchedulesClient({identity,storage:localStorage,credential:()=>sessionStorage.getItem(CLASS_ACCESS_KEY+':'+identity.schoolId+':'+identity.teacherId)||'',transport:classTransport});return scheduleClient;}
function renderNavigation(current,identity){const nav=node('nav');nav.setAttribute('aria-label','Main navigation');for(const [name,url]of teacherMenu(!!identity)){const item=link(name,url);item.classList.add('nav-button');if(url===current){item.setAttribute('aria-current','page');item.classList.add('is-current');}nav.append(item);}if(identity)nav.append(action('Logout',()=>{sessionStorage.removeItem(TEACHER_KEY);sessionStorage.removeItem(CLASS_ACCESS_KEY+':'+identity.schoolId+':'+identity.teacherId);classTransport?.dispose();classClient=null;scheduleClient=null;if(location.hash==='#home')renderSafe();else location.hash='#home';}));app.append(nav);}
async function render(){disposeResults?.();disposeResults=null;const version=++renderVersion;if(legacyExamRoute(location.hash)){location.replace('exam.html'+location.hash);return;}app.replaceChildren();const current=route(location.hash),identity=teacher();if(current!=='#home'&&current!=='#login'&&!identity){location.hash='#login';return;}
if(current==='#login'&&identity){location.hash='#dashboard';return;}renderNavigation(current,identity);if(current==='#home'){app.append(node('h1','JFT-Basic Mock Test'));const cards=node('div');cards.className='cards home-cards';for(const [name,label,url] of [['Student','Take a Test','exam.html'],['Teacher',identity?'Teacher Dashboard':'Teacher Login',identity?'#dashboard':'#login']]){const c=node('section');c.className='card';const a=link(label,url);a.className='button '+(name==='Student'?'home-student':'home-teacher');c.append(node('h2',name),a);cards.append(c);}app.append(cards);return;}
if(current==='#login'){app.append(node('h1','Teacher Login'));const notice=node('p','Development login only. Classes requires a separate private school access key. Results requires the same private school access key.');notice.className='notice';const form=node('form');form.className='card';form.append(field('ID','loginId'),field('Password','password','password'));const b=node('button','Login');b.type='submit';form.append(b);form.onsubmit=e=>{e.preventDefault();const d=new FormData(form),value=authenticate(String(d.get('loginId')),String(d.get('password')));if(!value){error('ID or password is incorrect.');return;}try{sessionStorage.setItem(TEACHER_KEY,JSON.stringify(value));location.hash='#dashboard';}catch{error('Browser session storage is unavailable.');}};app.append(notice,form);return;}
const note=node('p','Phase 2B: Classes and schedule plans are shared through Google Sheets. Schedules do not publish or restrict student tests.');note.className='notice';if(current!=='#results')app.append(note);
if(current==='#results'){clientFor(identity);const resultsClient=createResultsClient({identity,credential:()=>sessionStorage.getItem(CLASS_ACCESS_KEY+':'+identity.schoolId+':'+identity.teacherId)||'',transport:classTransport});disposeResults=showResults({container:app,identity,client:resultsClient,accessStorage:sessionStorage});return;}
let data;try{data=repository.load();}catch(e){error(e.message);return;}
if(current==='#dashboard'){app.append(node('h1','Teacher Dashboard'));const cards=node('div');cards.className='cards dashboard-cards';for(const [title,url]of [['Schedule Test','#schedule'],['Results','#results'],['Classes','#classes']]){const c=node('section');c.className='card';const open=action('Open',()=>{location.hash=url;});open.className='dashboard-open';open.setAttribute('aria-label','Open '+title);c.append(node('h2',title),open);cards.append(c);}app.append(cards);return;}
const legacyClasses=data.classes.filter(c=>c.schoolId===identity.schoolId);
if(current==='#classes'){showClasses({container:app,identity,client:clientFor(identity),legacyClasses,accessStorage:sessionStorage});return;}
if(current==='#schedule'){showSchedules({container:app,identity,client:scheduleFor(identity),classesClient:clientFor(identity),initialClasses:[],tests:data.tests,legacyDrafts:legacyScheduleDrafts(data,identity),accessStorage:sessionStorage});return;}
}
installFullscreen({button:document.querySelector('#fullscreen-toggle'),status:document.querySelector('#fullscreen-status')});
document.querySelector('#portal-build').textContent='Build: teacher-results-v23';
const renderSafe=()=>render().catch(e=>error(e.message));
window.addEventListener('hashchange',renderSafe);renderSafe();
