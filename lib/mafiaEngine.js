// ===== Azahrabot Mafia Engine FINAL UX FIXED =====

const games = {};
const sessions = {};

const NIGHT = 90000;
const DISCUSS = 90000;
const VOTE = 60000;

function roles(n){
return {
mafia: Math.max(1,Math.floor(n/4)),
doctor: Math.max(1,Math.floor(n/8))
};
}

function create(gid){
if(games[gid]) return {ok:false,msg:"⚠️ Game already running"};

games[gid]={
phase:"lobby",
players:[],
votes:{},
kills:[],
save:null,
mafiaKills:{}
};

return {ok:true};
}

function join(gid,jid,name){

const g=games[gid];
if(!g) return {ok:false,msg:"No lobby"};
if(g.phase!=="lobby") return {ok:false,msg:"Game started"};

if(g.players.find(p=>p.jid===jid))
return {ok:false,msg:"Already joined"};

const num=g.players.length+1;

g.players.push({
jid,
name,
num,
role:null,
alive:true
});

sessions[jid]=gid;

return {ok:true,num};
}

function leave(jid){

const gid=sessions[jid];
if(!gid) return {ok:false};

const g=games[gid];

if(g.phase!=="lobby")
return {ok:false,msg:"Game already started"};

g.players=g.players.filter(p=>p.jid!==jid);

delete sessions[jid];

return {ok:true};
}

function start(gid){

const g=games[gid];
if(!g) return {ok:false,msg:"No game"};
if(g.players.length<4)
return {ok:false,msg:"Need 4 players"};

const {mafia,doctor}=roles(g.players.length);

let sh=[...g.players].sort(()=>Math.random()-0.5);

for(let i=0;i<mafia;i++) sh[i].role="mafia";
for(let i=mafia;i<mafia+doctor;i++) sh[i].role="doctor";
for(let i=mafia+doctor;i<sh.length;i++) sh[i].role="civilian";

g.phase="night";
g.kills=[];
g.votes={};
g.save=null;
g.mafiaKills={};

return {ok:true};
}

function getPlayerGame(jid){
return games[sessions[jid]];
}

// ================= KILL =================
function kill(jid,num){

const g=getPlayerGame(jid);
if(!g) return {ok:false,msg:"No game"};
if(g.phase!=="night") return {ok:false,msg:"Not night"};

const p=g.players.find(x=>x.jid===jid);
if(!p || !p.alive)
return {ok:false,msg:"Dead"};

if(p.role!=="mafia")
return {ok:false,msg:"Only mafia"};

if(g.mafiaKills[jid])
return {ok:false,msg:"You already locked kill"};

const n=Number(num);
const t=g.players.find(x=>x.num===n && x.alive);

if(!t) return {ok:false,msg:"Invalid target"};

if(g.kills.includes(t.jid))
return {ok:false,msg:"Target already chosen"};

g.mafiaKills[jid]=t.jid;
g.kills.push(t.jid);

return {ok:true,msg:`🔪 Target locked: Player ${t.num}`};
}

// ================= SAVE =================
function save(jid,num){

const g=getPlayerGame(jid);
if(!g) return {ok:false,msg:"No game"};

if(g.phase!=="night")
return {ok:false,msg:"Not night"};

const doctor=g.players.find(p=>p.jid===jid);

if(!doctor) return {ok:false,msg:"Not in game"};
if(!doctor.alive) return {ok:false,msg:"You are dead"};
if(doctor.role!=="doctor")
return {ok:false,msg:"Only doctor can save"};

const n=Number(num);
const target=g.players.find(p=>p.num===n);

if(!target) return {ok:false,msg:"Invalid player number"};
if(!target.alive) return {ok:false,msg:"Player already dead"};

g.save=target.jid;

return {ok:true,msg:`💉 Saving Player ${target.num}`};
}

// ================= VOTE =================
function vote(jid,num){

const g=getPlayerGame(jid);
if(!g) return {ok:false,msg:"No game"};
if(g.phase!=="vote") return {ok:false,msg:"Voting closed"};

const p=g.players.find(x=>x.jid===jid);
if(!p || !p.alive)
return {ok:false,msg:"Dead players cannot vote"};

const n=Number(num);
const target=g.players.find(x=>x.num===n);

if(!target)
return {ok:false,msg:"Invalid player"};

if(!target.alive)
return {ok:false,msg:"❌ You cannot vote a dead player"};

g.votes[jid]=target.jid;

return {ok:true,msg:`🗳️ Vote counted for Player ${target.num}`};
}

// ================= MAFIA CHAT =================
async function mafiaSay(sock,jid,text){

const g=getPlayerGame(jid);
if(!g) return;

const p=g.players.find(x=>x.jid===jid);
if(!p || p.role!=="mafia" || !p.alive) return;

const team=g.players.filter(x=>x.role==="mafia" && x.alive);

for(const m of team){
if(m.jid===jid) continue;

await sock.sendMessage(
m.jid,
{ text:`🕶 Mafia Chat\nPlayer ${p.num}: ${text}` }
).catch(()=>{});
}
}

// ================= RESOLVE NIGHT =================
function resolveNight(g){

const deaths=[];

g.kills.forEach(j=>{

const t=g.players.find(x=>x.jid===j);

if(j===g.save) return;

t.alive=false;

deaths.push({
jid:t.jid,
num:t.num,
role:t.role
});

});

g.kills=[];
g.save=null;
g.mafiaKills={};

return deaths;
}

// ================= RESOLVE VOTE =================
function resolveVote(g){

const map={};

Object.values(g.votes).forEach(j=>{
map[j]=(map[j]||0)+1;
});

g.votes={};

let max=0;
let dead=null;
let tie=false;

for(const j in map){

if(map[j]>max){
max=map[j];
dead=j;
tie=false;
}
else if(map[j]===max){
tie=true;
}

}

if(!dead || tie)
return {tie:true};

const p=g.players.find(x=>x.jid===dead);

p.alive=false;

return {
dead:true,
jid:p.jid,
num:p.num,
role:p.role
};
}

function win(g){

const alive=g.players.filter(x=>x.alive);

const mafia=alive.filter(x=>x.role==="mafia").length;
const civ=alive.length-mafia;

if(mafia===0) return "CIVILIANS";
if(mafia>=civ) return "MAFIA";

return null;
}

function reveal(g){

let text="📜 Final Roles\n\n";
let mentions=[];

g.players.forEach(p=>{
text+=`Player ${p.num} — ${p.role}\n`;
mentions.push(p.jid);
});

return {text,mentions};
}

function endGame(gid){

const g=games[gid];
if(!g) return;

g.players.forEach(p=>{
delete sessions[p.jid];
});

delete games[gid];
}

module.exports={
games,
create,
join,
leave,
start,
kill,
save,
vote,
mafiaSay,
resolveNight,
resolveVote,
win,
reveal,
getPlayerGame,
endGame,
NIGHT,
DISCUSS,
VOTE
};