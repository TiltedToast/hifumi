import * as fsPromise from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { Headers } from 'node-fetch';
import { credentials } from './config.js';

export function strftime(sFormat, date) {
    if (!(date instanceof Date)) date = new Date();
    var nDay = date.getDay(),
      nDate = date.getDate(),
      nMonth = date.getMonth(),
      nYear = date.getFullYear(),
      nHour = date.getHours(),
      aDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      aMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      aDayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
      isLeapYear = function() {
        return (nYear%4===0 && nYear%100!==0) || nYear%400===0;
      },
      getThursday = function() {
        var target = new Date(date);
        target.setDate(nDate - ((nDay+6)%7) + 3);
        return target;
      },
      zeroPad = function(nNum, nPad) {
        return ((Math.pow(10, nPad) + nNum) + '').slice(1);
      };
    return sFormat.replace(/%[a-z]/gi, function(sMatch) {
      return (({
        '%a': aDays[nDay].slice(0,3),
        '%A': aDays[nDay],
        '%b': aMonths[nMonth].slice(0,3),
        '%B': aMonths[nMonth],
        '%c': date.toUTCString(),
        '%C': Math.floor(nYear/100),
        '%d': zeroPad(nDate, 2),
        '%e': nDate,
        '%F': date.toISOString().slice(0,10),
        '%G': getThursday().getFullYear(),
        '%g': (getThursday().getFullYear() + '').slice(2),
        '%H': zeroPad(nHour, 2),
        '%I': zeroPad((nHour+11)%12 + 1, 2),
        '%j': zeroPad(aDayCount[nMonth] + nDate + ((nMonth>1 && isLeapYear()) ? 1 : 0), 3),
        '%k': nHour,
        '%l': (nHour+11)%12 + 1,
        '%m': zeroPad(nMonth + 1, 2),
        '%n': nMonth + 1,
        '%M': zeroPad(date.getMinutes(), 2),
        '%p': (nHour<12) ? 'AM' : 'PM',
        '%P': (nHour<12) ? 'am' : 'pm',
        '%s': Math.round(date.getTime()/1000),
        '%S': zeroPad(date.getSeconds(), 2),
        '%u': nDay || 7,
        '%V': (function() {
                var target = getThursday(),
                  n1stThu = target.valueOf();
                target.setMonth(0, 1);
                var nJan1 = target.getDay();
                if (nJan1!==4) target.setMonth(0, 1 + ((4-nJan1)+7)%7);
                return zeroPad(1 + Math.ceil((n1stThu-target)/604800000), 2);
              })(),
        '%w': nDay,
        '%x': date.toLocaleDateString(),
        '%X': date.toLocaleTimeString(),
        '%y': (nYear + '').slice(2),
        '%Y': nYear,
        '%z': date.toTimeString().replace(/.+GMT([+-]\d+).+/, '$1'),
        '%Z': date.toTimeString().replace(/.+\((.+?)\)$/, '$1')
      }[sMatch] || '') + '') || sMatch;
    });
  }

export function getOptionsArray(array) {
    let optionsArray = [];
    for (let i = 0; i < array.length; i++) {
		optionsArray.push(array[i].name);
	}
    return optionsArray;
}

export function errorLog(interaction, errorObject) {
  const currentTime = strftime("%d/%m/%Y %H:%M:%S");


  let errorMessage = `An Error occurred on ${currentTime}
  **Server:** ${interaction.guild.name} - ${interaction.guild.id}
  **Room:** ${interaction.channel.name} - ${interaction.channel.id}
  **User:** ${interaction.user.username} - ${interaction.user.id}
  **Command used:** ${interaction.toString()}
  **Error:** ${errorObject.message}\n
  **${errorObject.stack}**\n
  <@258993932262834188>`

  if (errorMessage.length > 2000) {
    errorMessage = `An Error occurred on ${currentTime}\nCheck console for full error (2000 character limit)\n<@258993932262834188>`
  }

  interaction.deleteReply();
  interaction.channel.send(errorMessage);
}

export async function getUserFromUserAndId(client, interaction, optionsArray, option1, option2) {
  let user = undefined;
  try {
		if (optionsArray.length === 0) {
			user = interaction.user;
	
		} else if (optionsArray.includes(option1) && !optionsArray.includes(option2)) {
			user = interaction.options.getUser(option1);
	
		} else if (optionsArray.includes(option2) && !optionsArray.includes(option1)) {
			user = await client.users.fetch(interaction.options.getString(option2));
	
		} else if (optionsArray.includes(option1) && optionsArray.includes(option2)) {
			user = interaction.options.getUser(option1);
		}
  return user;

	} catch (DiscordAPIError) {return interaction.editReply('User not found!');}
}

export async function downloadURL(url, saveLocation) {
    const absSaveLocation = path.resolve(saveLocation);

    const myHeaders = new Headers();
    myHeaders.append('User-Agent', 'hifumi-js:v1.0.0:tiltedtoast27@gmail.com');

    if (url.includes("pximg")) {
      myHeaders.append('Referer', 'https://www.pixiv.net/');
    }

    const requestOptions = {
      method: 'GET',
      headers: myHeaders,
    }

    await fetch(url, requestOptions)
      .then(response => response.arrayBuffer())
      .then(buffer => fsPromise.writeFile(absSaveLocation, new Uint8Array(buffer)))
      .catch(error => console.log('error', error));
}


export function getImgType(url) {
    if (url.includes(".png") || url.includes(".webp")) {
        return "png";
    } else if (url.includes(".jpeg") || (url.includes(".jpg"))) {
        return "jpeg";
    } else if (url.includes(".gif")) {
        return "gif";
    } else if (url.includes(".svg")) {
        return "svg";
    } 
}


export function advRound(x) {
    if (Math.floor(x / 1) + (x % 1) === parseInt(x)) {
        return parseInt(x);
    } else {
        return parseFloat(x);
    }
}


export function extractEmoji(emojiString, id=false) {
    const emojiID = emojiString.split(":")[2].slice(0, -1)

    if (id) {
        return emojiID;
    }

    if (emojiString[1] === "a") {
        return `https://cdn.discordapp.com/emojis/${emojiID}.gif`;
    } else {
        return `https://cdn.discordapp.com/emojis/${emojiID}.png`;
    }
}


export function createTemp(directory) {
  const absPath = path.resolve(directory);
  
  if (fs.existsSync(absPath)) {
    fs.rmSync(absPath, {recursive: true});
    fs.mkdirSync(absPath);
  } else {
    fs.mkdirSync(absPath);
  }
}


export function isValidSize(fileLocation, size) {
  return fs.statSync(fileLocation).size <= size;
}