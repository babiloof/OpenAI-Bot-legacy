require('dotenv').config();
//const Keyv = require('keyv');
//const keyv = new Keyv('sqlite://database.sqlite');
//keyv.on('error', err => console.log('Connection Error', err));

//const sql = require("sqlite");
const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { verbose: console.log });
const https = require("https");
const csv = require('csv-parser');
const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });

const cooldown = new Set();
var loofquotes = ['blahapchap', 'oftera?', 'schpeelofta'];

//sql.open("./database.sqlite");

const classicitems = [];
fs.createReadStream('items.csv')
  .pipe(csv())
  .on('data', (data) => classicitems.push(data))
  .on('end', () => {
    console.log('Loaded WoW Classic items');
});

//vars...
var playerdkp = {};
var voiceready = true;
var bidstatus = false;
var bids = {};
var bidmsgid = '';
var picbidmsgid = '';
var binterval;
var ivalsmax = 10;
let dkpurl = "https://dkp.theboringguild.com/api.php?function=points&filter=character&format=json";
//channels...
var logchannel = {};
var dkpchannel = {};
var suggestionsinc = {};
var suggestionsout = {};

// Get our server
var sguild = {};

// Get our stats channels
var totalUsers = {};
var onlineUsers = {};
var guildmembers = {};

//functions...
const getJSON = function(url) {
	// return new pending promise
	return new Promise((resolve, reject) => {
		const request = https.get(url, (response) => {
			response.setEncoding("utf8");
			// handle http errors
			if (response.statusCode < 200 || response.statusCode > 299) {
				reject(new Error('Failed to load page, status code: ' + response.statusCode));
			}
			// temporary data holder
			const body = [];
			// on every content chunk, push it to the data array
			response.on('data', (chunk) => body.push(chunk));
			// we are done, resolve promise with those joined chunks
			response.on('end', () => {
				body.join('');
				json = JSON.parse(body);
				resolve(json);
			});
		});
		// handle connection errors of the request
		request.on('error', (err) => reject(err))
	})
};
  
async function updatedkp(){
	console.log('called updatedkp');
	await getJSON(dkpurl)
	.then((json) => {
		Object.keys(json['players']).forEach(function(key){
			if(json['players'][key].active=='1'){
				playerdkp[json['players'][key].id]=json['players'][key].name;
			}
		});
		//get history and add changes to playerdkp here
		//console.log(playerdkp);
		console.log('end getting dkp');
	})
	.catch((err) => console.error(err));
	console.log(playerdkp);
}
function comparedkp(a,b){
	let comp = 0;
	//$dkp_a=$player->points->{'multidkp_points:1'}->points_current_with_twink;
	if(a.dkp < b.dkp){
		comp = 1;
	} else if(a.dkp > b.dkp){
		comp = -1;
	}
	return comp;
}
function getUserFromMention(mention) {
	if (!mention) return;
	if (mention.startsWith('<@') && mention.endsWith('>')) {
		mention = mention.slice(2, -1);
		if (mention.startsWith('!')) {
			mention = mention.slice(1);
		}
		return client.users.cache.get(mention);
	}
}

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	client.user.setActivity('!commands', ({type: "LISTENING"}))
	/*
	sguild = client.guilds.cache.get('616299217232592896');
	totalUsers = client.channels.cache.get('842918472135737364');
	onlineUsers = client.channels.cache.get('842923179592515594');
	guildmembers = client.channels.cache.get('842923262357798962');
	*/
	client.guilds.cache.forEach( guild => {
		logchannel[guild.id] = guild.channels.cache.find(x => x.name === '📇log');
		dkpchannel[guild.id] = guild.channels.cache.find(x => x.name === '💎dkpbidding');
		suggestionsinc[guild.id] = guild.channels.cache.find(x => x.name === '🧯suggestions');
		suggestionsout[guild.id] = guild.channels.cache.find(x => x.name === '🚒suggestions');
	});
});

client.on('voiceStateUpdate', (oldState, newState) => {
	let newUserChannel = newState.channel;
	let oldUserChannel = oldState.channel;

	if(oldUserChannel === null && newUserChannel !== null){
		logchannel[newUserChannel.guild.id].send(`${newState.member.displayName} joined ${newUserChannel}`)
		//if (newState.id == process.env.JJ_ID) chatchannel.send('Gör plats!')
	} else if(newUserChannel === null){
		logchannel[oldUserChannel.guild.id].send(`${oldState.member.displayName} left ${oldUserChannel}`)
	} else if (oldUserChannel && newUserChannel && oldUserChannel.id != newUserChannel.id){
		logchannel[oldUserChannel.guild.id].send(`${newState.member.displayName} left ${oldUserChannel} and joined ${newUserChannel}`)
	}
});

client.on('message', msg => {
	if (msg.author.bot) return;
	//if (msg.author == client.user) return;
	function setargs(cmd){ //needs work...
		if (cmd.startsWith(process.env.PREFIX)){
			return cmd.slice(process.env.PREFIX.length).trim().split(/ +/g);
		} else {
			return cmd.trim().split(/ +/g);
		}
	}
	const args = setargs(msg.content);
	const command = args.shift().toLowerCase();
	console.log(`author: ${msg.author.username}, cmd: ${command}, args: ${args}`);
	
	if(msg.guild === null){
		switch(command){
			case 'dkp': //timer or cache to reduce request, or...? ...
				return;
				var chars;
				try {
					const stmt = db.prepare('SELECT charid FROM usercharacters WHERE discordid = ?');
					chars = stmt.all(msg.author.id);
					console.log(chars);
				} catch(err) {
					console.log(err);
					return msg.channel.send(`I´m having some rough problems`);
				}
				if(chars.length){
					dkpurlid=dkpurl+'&filterid='+chars[0].charid;
					getJSON(dkpurlid)
					.then((json) => {
						//console.log(dkp);
						msg.channel.send(`You have ${json['players'][Object.keys(json['players'])[0]].points['multidkp_points:1'].points_current_with_twink} DKP`);
					})
					.catch((err) => console.error(err));
				} else {
					msg.channel.send(`Could not get your DKP, make sure your character is added.\nYou can use "!char" in a channel to se what characters are added to you.\nOtherwise ask an Officer to add your character.`);
				}
				
			break;
			case 'bid':
				if (bidstatus){
					if (!isNaN(args[0])){
						const bidder = (msg.author.username);
						bids[bidder]=args[0];
						msg.reply(`You bid ${args[0]}\nClick here <#672972374936911882> to get back to bidding channel`);
					} else {
						msg.reply('You need to give me an amount you want to bid, ie `bid 75`\nClick here <#672972374936911882> to get back to bidding channel');
					}
				} else {
					msg.reply('No bidding currently ongoing. :person_shrugging:\nClick here <#672972374936911882> to get back to bidding channel');
				}
			break;
			default:
				var randloofquote = loofquotes[Math.floor(Math.random() * loofquotes.length)];
				msg.reply(randloofquote)
				//msg.reply('Unknown command? :person_shrugging:\nClick here <#672972374936911882> to get back to bidding channel');
		}
	} else {
		if(msg.channel.id === suggestionsinc[msg.guild.id].id){
			if(msg.member.roles.cache.some(r=>['Guild Master', 'Officer'].includes(r.name))) return;
			const exampleEmbed = new Discord.MessageEmbed()
				.setColor('#0099ff')
				//.setTitle('Some title')
				.setAuthor(msg.member.nickname || msg.member.user.username, msg.author.avatarURL({ dynamic:true }))
				.setDescription(msg.content)
				.setTimestamp()
				.setFooter(msg.id);
			suggestionsout[msg.guild.id].send(exampleEmbed).then(sentmsg => {
				sentmsg.react('👍')
				.then(() => sentmsg.react('👎'))
				.catch(() => console.error('One of the emojis failed to react.'));
			});
			msg.delete({ timeout: 0, reason: 'It had to be done.' });
			msg.author.send(`Thanks for your contribution! The Officer team will deal with it in a swift and gracefully manner. <:KappaPride:695969451962662953>\nCase identification number: ${msg.id}`);
		}
		if(msg.content.indexOf(process.env.PREFIX) !== 0) return; //move up?
		switch(command){
			case 'roll':
				const deathroll = args[0] || 100;
				const roll = Math.floor(Math.random() * deathroll) + 1;
				
				if (roll === 1) {
					msg.reply(` rolls ${roll} (1-${deathroll}) kwat or double?!`);
				} else {
					msg.reply(` rolls ${roll} (1-${deathroll})`);
				}
				msg.delete({ timeout: 200, reason: 'It had to be done.' });
			break;
			case 'lag':
			case 'lagg':
				//if(!msg.member.roles.cache.some(r=>["Guild Master", "Officer"].includes(r.name))) return msg.reply("Sorry, you don't have permissions to use this!");
				msg.guild.setRegion(msg.guild.region == 'eu-central' ? 'eu-west' : 'eu-central')
				.then(g => msg.reply(`Changed server to ${g.region} :earth_africa:`))
				.catch(console.error);
			break;
			case 'startbid':
				if(!msg.member.roles.cache.some(r=>['Guild Master', 'Officer'].includes(r.name))) return msg.reply('I wont allow you to do that!');
				if(bidstatus)return msg.reply('Theres allready bidding ongoing!');
				
				//call update dkp
				






				bidstatus = true;
				const tlgreen = ':green_circle:';
				const tlred = ':red_circle:';
				const arg = args.join(' ').replace(/[[\]]/g,'');
				const sitem = classicitems.find(o => o.name === arg);
				var item = sitem ? sitem : {entry: '?', name: '?'};
				if (arg) item.name = arg;
				//console.log(item);
				/*var embed = new Discord.MessageEmbed()
					.setTitle(`Taking bids for ${item.name}`)
					.setColor(0xa335ee)
					.setDescription(`Message me with bid and amount to bid.\nExample: \`\`bid 75\`\``)
					//.setImage(`https://openai.theboringguild.com/images/items/${item.entry}.png`)
					.addField('Initiated by', msg.member.nickname || msg.member.user.username, true)
					.addField('Itemid', item.entry, true)
					.addField('Time left', tlgreen.repeat(ivalsmax));*/
					//console.log(embed);
				var embed = {content: `Click here >>>${client.user}<<< to wisper bot.`,
					embed: {
					color: 0xa335ee,
					title: `Taking bids for ${item.name}`,
					description: `Message me with bid and amount to bid.\nExample: \`\`bid 75\`\``,
					fields: [{
						name: 'Initiated by',
						value: msg.member.nickname || msg.member.user.username
					},
					{
						name: 'Itemid',
						value: item.entry
					},
					{
						name: 'Time left',
						value: tlgreen.repeat(ivalsmax)
					}
					]
				}
				};
				dkpchannel[msg.guild.id].send(embed).then(msgid => {
					bidmsgid = msgid.id;
					var ivals = 10;
					binterval = setInterval(function(){
						//check if deleted...
						if (ivals === 0) {
							clearInterval(binterval);
							bidstatus = false;
							const maxMinVal = (obj) => {
								const sortedEntriesByVal = Object.entries(obj).sort(([, v1], [, v2]) => v1 - v2);
								return sortedEntriesByVal[sortedEntriesByVal.length - 1];
								/*{
								min: sortedEntriesByVal[0],
								max: sortedEntriesByVal[sortedEntriesByVal.length - 1],
								sortedObjByVal: sortedEntriesByVal.reduce((r, [k, v]) => ({ ...r, [k]: v }), {}),
								};*/
							};
							const winner = (maxMinVal(bids));
							bids = {};
							if(winner){
								const nEmbed = new Discord.MessageEmbed()
									.setTitle(`Congratulations ${winner[0]}`)
									.setColor(0xa335ee)
									.setDescription(`You won ${item.name}\nPrice: ${winner[1]}`)
									.setImage(`https://openai.theboringguild.com/images/items/${item.entry}.png`)
									.addField('Initiated by', (msg.member.nickname || msg.member.user.username), true)
									.addField('Itemid', item.entry, true)
								msgid.edit(nEmbed).catch(console.error);
							} else {
								const nEmbed = new Discord.MessageEmbed()
									.setTitle(`No bids for ${item.name}`)
									.setColor(0xa335ee)
									.setDescription(`No bids for ${item.name}`)
									.setImage(`https://openai.theboringguild.com/images/items/${item.entry}.png`)
									.addField('Initiated by', (msg.member.nickname || msg.member.user.username), true)
									.addField('Itemid', item.entry, true)
								msgid.edit(nEmbed).catch(console.error);
							}
							if(item.entry!='?'){
								dkpchannel[msg.guild.id].messages.fetch(picbidmsgid).then(msg => msg.delete());
							}
							return;
						}
						ivals--;
						const tl = (tlgreen.repeat(ivals)) + (tlred.repeat(ivalsmax-ivals));
						embed.embed.fields[2]['value'] = tl;
						msgid.edit(embed);
					}, 1 * 2000);
				});
				if(item.entry!='?'){
					var picembed = new Discord.MessageEmbed()
						.setColor(0xa335ee)
						.setImage(`https://openai.theboringguild.com/images/items/${item.entry}.png`);
					dkpchannel[msg.guild.id].send(picembed).then(msgid => {
						picbidmsgid = msgid.id;
					});
				}
				msg.delete({ timeout: 200, reason: 'It had to be done.' });
			break;
			case 'cancelbid':
				if(!msg.member.roles.cache.some(r=>['Guild Master', 'Officer'].includes(r.name))) return msg.reply('I wont allow you to do that!');
				if(!bidstatus)return msg.reply('Theres no bidding ongoing!');
				bidstatus=false;
				clearInterval(binterval);
				dkpchannel[msg.guild.id].messages.fetch(bidmsgid).then(msg => msg.delete({ timeout: 200, reason: 'It had to be done.' }));
				if(picbidmsgid!=''){
					dkpchannel[msg.guild.id].messages.fetch(picbidmsgid).then(msg => msg.delete({ timeout: 200, reason: 'It had to be done.' }));
					picbidmsgid='';
				}
				msg.delete({ timeout: 200, reason: 'It had to be done.' });
			break;
			case 'topdkp':
				return;
				getJSON(dkpurl)
					.then((json) => {
						//console.log(json['info']);
						//console.log(json['players']['player:76']);
						//console.log(json['players']['player:76'].points['multidkp_points:1'].points_current_with_twink);
						//players.sort(comparedkp);
						var players = [];
						Object.keys(json['players']).forEach(function(key){
							//console.log(key);
							//console.log(index);
							//console.log(json['players'][key].name);
							//console.log(json['players'][key].points['multidkp_points:1'].points_current_with_twink);
							if(json['players'][key].active=='1'){
								if(json['players'][key].id==json['players'][key].main_id){
									players.push({ name: json['players'][key].name, dkp: parseInt(json['players'][key].points['multidkp_points:1'].points_current_with_twink) });
								}
							}
						});
						players.sort(comparedkp);
						//console.log(players[0].name);
						//msg.reply(`Here´s a list of top 10 DKP players\n1: ${players[0].name} (${players[0].dkp})\n2: ${players[1].name} (${players[1].dkp})\n3: ${players[2].name} (${players[2].dkp})\n4: ${players[3].name} (${players[3].dkp})\n5: ${players[4].name} (${players[4].dkp})\n6: ${players[5].name} (${players[5].dkp})\n7: ${players[6].name} (${players[6].dkp})\n8: ${players[7].name} (${players[7].dkp})\n9: ${players[8].name} (${players[8].dkp})\n10: ${players[9].name} (${players[9].dkp})`);
						//msg.reply(`Here´s a list of top 3 DKP players\n:first_place: ${players[0].name} (${players[0].dkp})\n:second_place: ${players[1].name} (${players[1].dkp})\n:third_place: ${players[2].name} (${players[2].dkp})`);
						msg.reply(`Here´s a list of top 3 DKP players\n🥇 ${players[0].name} (${players[0].dkp})\n🥈 ${players[1].name} (${players[1].dkp})\n🥉 ${players[2].name} (${players[2].dkp})`);
					})
					.catch((err) => console.error(err));
			break;
			case 'commands':
				var embed = {"embed": {
					"title": "OpenAI Help",
					"description": "Here is a list of [commands](https://openai.theboringguild.com/commands/)",
					"url": "https://openai.theboringguild.com/commands/",
					"color": 1794479
				  }
				};
				//msg.author.send('https://openai.theboringguild.com/commands/');
				msg.reply(embed);
				msg.delete({ timeout: 200, reason: 'It had to be done.' });
			break;
			case 'idjet':
				msg.author.send('RIP 6.10.2020 !idjet');
				msg.delete({ timeout: 200, reason: 'It had to be done.' });
			break;
			case 'spit':
			case 'puke':
			//case 'idjet':
			case 'notyell':
			case 'yell':
			case 'shutup':
			case 'suck':
			case 'suck2':
			case 'jadont':
			case 'jadodont':
			case 'dispelkenp':
			case 'wars':
			case 'damjado':
			case 'kanmanbald':
			case 'jadostfu':
			case 'rumble':
			case 'kidnap':
			case 'wtf':
			case 'pee':
			case 'kenpee':
			case 'hak':
			case 'coopmom':
			case 'potato':
			case 'howmany':
			case 'urine':
			case 'gooddick':
			case 'crack':
			case 'rolled':
			case 'butch':
			case 'broblem':
			case 'pump':
			case 'axenonce':
			case 'nonsetoface':
				if (cooldown.has(msg.author.id)) {
						//msg.channel.send(":tired_face:" /*+ msg.author*/);
						msg.author.send(":tired_face:" /*+ msg.author*/);
				} else {
			
					//if(!msg.member.roles.cache.some(r=>['Guild Master', 'Officer'].includes(r.name))) return msg.reply('I wont allow you to do that!');
					//if(!msg.member.voice.channel.name == "raid-1") return;
					//console.log(msg.member.voice.channel);
					if (voiceready && msg.member.voice.channel){
						if(msg.member.voice.channel.name == '25-man-raid-1' || msg.member.voice.channel.name == '25-man-raid-2' || msg.member.voice.channel.name == 'summoning'){
							msg.author.send("Raidtime, focus up!" /*+ msg.author*/);
						} else {
							voiceready = false;
							var voiceChannel = msg.member.voice.channel;
							voiceChannel.join().then(connection => {
								const dispatcher = connection.play('./'+command+'.mp3');
								dispatcher.on("finish", () => {
									voiceChannel.leave();
								});
							}).catch(err => console.log(err));
							voiceready = true;
						}
					}
					// Adds the user to the set so that they can't talk for a minute
					cooldown.add(msg.author.id);
					setTimeout(() => {
						// Removes the user from the set after a minute
						cooldown.delete(msg.author.id);
					}, 20000);
				}
				msg.delete({ timeout: 200, reason: 'It had to be done.' });
			break;
			case 'avatar':
				//if(!msg.member.roles.cache.some(r=>['Guild Master', 'Officer'].includes(r.name))) return msg.reply('I wont allow you to do that!');
				if (args[0]) {
					const user = getUserFromMention(args[0]);
					console.log(user);
					if (!user) {
						msg.reply('Please use a proper mention if you want to see someone else\'s avatar.');
					} else {
						msg.channel.send(`${user.username}'s avatar: ${user.displayAvatarURL({ dynamic: true })}`);
					}
				} else {
					msg.channel.send(`${msg.author.username}, your avatar: ${msg.author.displayAvatarURL({ dynamic: true })}`);
				}
			break;
			case 'addchar':
				if(!msg.member.roles.cache.some(r=>['Guild Master', 'Officer'].includes(r.name))) return msg.reply('I wont allow you to do that!');
				if (args[0] && args[1]) {
					getJSON(dkpurl)
					.then((json) => {
						var players = [];
						Object.keys(json['players']).forEach(function(key){
							if(json['players'][key].active=='1'){
								players.push({ id: json['players'][key].id, name: json['players'][key].name });
							}
						});
						//console.log(players);
						var char = players.filter(obj => {
							return obj.name.toUpperCase() === args[1].toUpperCase()
						});
						const user = getUserFromMention(args[0]);
						//console.log(user);
						//console.log(`${user} | ${char[0].name}`);
						if (user && char.length) {
							//msg.channel.send(`${user.username}'s id: ${user.id}`);
							const stmt = db.prepare('INSERT INTO usercharacters (discordid, charid) VALUES (?, ?)');
							try {
								const info = stmt.run(user.id, char[0].id);
								console.log(info.changes);
								msg.channel.send(`Added character ${char[0].name} to ${user}`);
							} catch(err) {
								console.log(err);
								msg.channel.send(`Error, check if user has character allready, with !char\n${err.toString()}`);
							}
						} else {
							msg.reply('Couldnt find user or character :person_shrugging:');
						}
					})
					.catch((err) => console.error(err));
				} else {
					msg.reply('Invalid... well... yea, try this "!addchar @mention charname", go agane!');
				}
			break;
			case 'char': //change to SQL before getting JSON
				return;
				var user;
				if (args[0]) {
					user = getUserFromMention(args[0]);
				} else {
					user=msg.author;
				}
				getJSON(dkpurl)
				.then((json) => {
					var players = {};
					Object.keys(json['players']).forEach(function(key){
						if(json['players'][key].active=='1'){
							//players.push({ id: json['players'][key].id, name: json['players'][key].name });
							players[json['players'][key].id]=json['players'][key].name;
						}
					});
					
					if (user){
						try {
							const stmt = db.prepare('SELECT charid FROM usercharacters WHERE discordid = ?');
							const chars = stmt.all(user.id);
							console.log(chars);
							var charnames='';
							chars.forEach(c => {
								console.log(players[c.charid]);
								charnames+=players[c.charid];
								charnames+=', ';
							});
							charnames = charnames.substring(0, charnames.length - 2);
							//console.log(charnames);
							if (args[0]) {
								//console.log(user);
								msg.channel.send(`${user} characters are: ${charnames}`);
							} else {
								msg.channel.send(`Your characters are: ${charnames}`);
							}
							
						} catch(err) {
							console.log(err);
							msg.channel.send(`Im having some problems`);
						}
					} else {
						msg.reply('Couldnt find user :person_shrugging:');
					}
				})
				.catch((err) => console.error(err));
			break;
			case 'item':
				const argi = args.join(' ').replace(/[[\]]/g,'');
				const sitemi = classicitems.find(o => o.name.toUpperCase() === argi.toUpperCase());
				var item = sitemi ? sitemi : {entry: '?', name: '?'};
				//if (argi) item.name = argi;
				console.log(item);
				if(item.name=='?'){
					msg.reply(`Could not find item ${argi} :person_shrugging:`);
				} else {
					const itemembed = new Discord.MessageEmbed()
					.setImage(`https://openai.theboringguild.com/images/items/${item.entry}.png`)
					msg.reply(itemembed).catch(console.error);
				}
				
			break;
			case 'classassign':
				if(!msg.member.roles.cache.some(r=>['Guild Master', 'Officer'].includes(r.name))) return msg.reply('I wont allow you to do that!');
				if (msg.channel.name === "❔class-assignments") { //class-assignments
					msg.channel.send('Choose your class (or any class you are interested in)').then(sentmsg => {
						sentmsg.react('998913772213252146')
						.then(() => sentmsg.react('670994168281169920'))
						.then(() => sentmsg.react('670994226942836761'))
						.then(() => sentmsg.react('670994159376793639'))
						.then(() => sentmsg.react('670994207565021195'))
						.then(() => sentmsg.react('670994100555743253'))
						.then(() => sentmsg.react('670994179563978753'))
						.then(() => sentmsg.react('670994127944548352'))
						.then(() => sentmsg.react('670994142746378253'))
						.then(() => sentmsg.react('670992421907071016'))
						.catch(() => console.error('One of the emojis failed to react.'));
					});
				}
				msg.delete({ timeout: 200, reason: 'It had to be done.' });
			break;
			case 'pugassign':
				if(!msg.member.roles.cache.some(r=>['Guild Master', 'Officer'].includes(r.name))) return msg.reply('I wont allow you to do that!');
				if (msg.channel.name === "❔info") { //class-assignments
					msg.channel.send('Welcome to The Boring Guild’s Discord, if you would like to join our pugs change your nickname to your ingame name, read the <#725364524680609819> and emote with anything on this post to get access to the signup channels.').then(sentmsg => {
						sentmsg.react('796428248808423454')
						.then(() => sentmsg.react('695969451769856093'))
						.then(() => sentmsg.react('695969451824250921'))
						.then(() => sentmsg.react('695969452180766720'))
						.catch(() => console.error('One of the emojis failed to react.'));
					});
				}
				msg.delete({ timeout: 200, reason: 'It had to be done.' });
			break;
			case 'test0':
				console.log(asd);
				return;
				//if(!msg.member.roles.cache.some(r=>['Guild Master', 'Officer'].includes(r.name))) return msg.reply('I wont allow you to do that!');
				getJSON(dkpurl)
				.then((json) => {
					console.log(json);
				})
				.catch((err) => console.error(err));
			break;
			case 'test1':
				msg.delete();
				//updatedkp();
				const exampleEmbed = new Discord.MessageEmbed()
					.setColor('#0099ff')
					//.setTitle('Some title')
					.setAuthor(msg.member.nickname || msg.member.user.username, msg.author.avatarURL({ dynamic:true }))
					.setDescription(msg.content)
					.setTimestamp()
					.setFooter(msg.id);
				suggestionsout[msg.guild.id].send(exampleEmbed).then(sentmsg => {
					sentmsg.react('👍')
					.then(() => sentmsg.react('👎'))
					.catch(() => console.error('One of the emojis failed to react.'));
				});
			break;
			//musicbot commands
			case 'play':
			case 'settings':
			case 'skip':
			case 'search':
			case 'lyrics':
			case 'fs':
			case 'createEvent':
			case 'leave':
			break;
			default:
				//msg.reply('Unknown command? :person_shrugging:'); // removed... use !commands
		}
	}
});

client.on('raw', packet => {
	// We don't want this to run on unrelated packets
	if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) { return; }
	// Grab the channel to check the message from
	const channel = client.channels.resolve(packet.d.channel_id);
	// There's no need to emit if the message is cached, because the event will fire anyway for that
	//if (channel.messages.cache.get(packet.d.message_id)) { return; }
	// Since we have confirmed the message is not cached, let's fetch it
	channel.messages.fetch(packet.d.message_id).then(function (message) {
		// Emojis can have identifiers of name:id format, so we have to account for that case as well
		const emoji = packet.d.emoji.id ? "" + packet.d.emoji.id : packet.d.emoji.name;
		// This gives us the reaction we need to emit the event properly, in top of the message object
		const reaction = message.reactions.resolve(emoji);
		// Adds the currently reacting user to the reaction's users collection.
		if (reaction) { reaction.users[packet.d.user_id] = client.users.fetch(packet.d.user_id); }
		// Check which type of event it is before emitting
		if (packet.t === 'MESSAGE_REACTION_ADD') {
			client.emit('messageReactionAdd', reaction, client.users.fetch(packet.d.user_id));
		}
		if (packet.t === 'MESSAGE_REACTION_REMOVE') {
			client.emit('messageReactionRemove', reaction, client.users.fetch(packet.d.user_id));
		}
	});
});

client.on('messageReactionAdd', async (reaction, user) => {
	if (reaction.message.channel.name === "❔class-assignments") { //class-assignments
		switch(reaction.emoji.name){
			case 'Druid':
			case 'DeathKnight':
			case 'Hunter':
			case 'Mage':
			case 'Paladin':
			case 'Priest':
			case 'Rogue':
			case 'Shaman':
			case 'Warlock':
			case 'Warrior':
				const guild = reaction.message.guild;
				const role = guild.roles.cache.find(role => role.name === reaction.emoji.name);
				guild.members.fetch(user.id)
					.then(memberWhoReacted => memberWhoReacted.roles.add(role))
					.catch(console.error);
				console.log('Added class role');
			break;
			default:

		}
	} else if (reaction.message.channel.name === "❔info") {
		if (reaction.message.author == client.user){
			const guild = reaction.message.guild;
			const role = guild.roles.cache.find(role => role.name === 'PUG');
			guild.members.fetch(user.id)
				.then(memberWhoReacted => memberWhoReacted.roles.add(role))
				.catch(console.error);
			console.log('Added pug role');
		}
	}
});

client.on('messageReactionRemove', async (reaction, user) => {
	if (reaction.message.channel.name === "❔class-assignments") { //class-assignments
		switch(reaction.emoji.name){
			case 'Druid':
			case 'DeathKnight':
			case 'Hunter':
			case 'Mage':
			case 'Paladin':
			case 'Priest':
			case 'Rogue':
			case 'Shaman':
			case 'Warlock':
			case 'Warrior':
				const guild = reaction.message.guild;
				const role = guild.roles.cache.find(role => role.name === reaction.emoji.name);
				guild.members.fetch(user.id)
					.then(memberWhoReacted => memberWhoReacted.roles.remove(role))
					.catch(console.error);
				console.log('Removed class role');
			break;
			default:

		}
	} else if (reaction.message.channel.name === "❔info") {
		if (reaction.message.author == client.user){
			const guild = reaction.message.guild;
			const role = guild.roles.cache.find(role => role.name === 'PUG');
			guild.members.fetch(user.id)
				.then(memberWhoReacted => memberWhoReacted.roles.remove(role))
				.catch(console.error);
			console.log('Removed pug role');
		}
	}
});

client.login(process.env.BOT_TOKEN);


/*
// Check every 60 seconds for changes
// 2 per 10 minutes per channel ???
setInterval(function() {
	console.log('Getting stats update..')
	//console.log(sguild);

	
	//Get actual counts
	var userCount = sguild.memberCount;
	var onlineCount = sguild.members.cache.filter(member => member.presence.status === "online").size;
	//var memberCount = 20; //sguild.roles.cache.get('622715440602546215').members.size + sguild.roles.cache.get('622715631808020501').members.size + sguild.roles.cache.get('622715747973464086').members.size + sguild.roles.cache.get('622722361665519639').members.size;
	
	// Log counts for debugging
	console.log("Total Users: " + userCount);
	console.log("Online Users: " + onlineCount);
	//console.log("Guild members: " + memberCount);
  
	// Set channel names
	totalUsers.setName("Total Users: " + userCount)
	.then(newChannel => console.log(`Stat channel renamed to: ${newChannel.name}`))
	.catch(console.error);
    
	onlineUsers.setName("Online Users: " + onlineCount)
	.then(newChannel => console.log(`Stat channel renamed to: ${newChannel.name}`))
	.catch(console.error);
	
	guildmembers.setName("Guild members: " + memberCount)
	.then(newChannel => console.log(`Stat channel renamed to: ${newChannel.name}`))
	.catch(console.error); 
}, 60000)

*/