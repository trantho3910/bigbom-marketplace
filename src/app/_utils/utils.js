class Utils {
    getNetwork(netId) {
        switch (netId) {
            case '1':
                return 'MAINNET';
            case '2':
                return 'MORDEN';
            case '3':
                return 'ROPSTEN';
            case '4':
                return 'RINKEBY';
            case '42':
                return 'KOVAN';
            case '89':
                return 'TOMOCHAIN';
            default:
                return 'UNKNOW';
        }
    }

    callMethod(_method) {
        return (...param) => {
            return new Promise(resolve => {
                _method(...param, (error, result) => {
                    resolve([error, result]);
                });
            });
        };
    }

    callMethodWithReject(_method) {
        return (...param) => {
            return new Promise((resolve, reject) => {
                _method(...param, (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            });
        };
    }

    callAllMethodWithReject(promises) {
        return new Promise(async resolve => {
            let result = await Promise.all(promises);
            let error = null;
            result = result.map(item => {
                const [e, r] = item;
                e && !error && (error = e);
                return r;
            });

            if (error) {
                resolve([error, null]);
            } else {
                resolve([null, result]);
            }
        });
    }

    callAllMethod(promises) {
        return new Promise(async resolve => {
            try {
                const result = await Promise.all(promises);
                resolve([null, result]);
            } catch (error) {
                resolve([error, null]);
            }
        });
    }

    truncate = (fullStr, strLen, separator) => {
        if (fullStr.length <= strLen) return fullStr;
        separator = separator || '...';
        var sepLen = separator.length,
            charsToShow = strLen - sepLen,
            frontChars = Math.ceil(charsToShow / 2),
            backChars = Math.floor(charsToShow / 2);

        return fullStr.substr(0, frontChars) + separator + fullStr.substr(fullStr.length - backChars);
    };

    getStatusJobOpen = bid => {
        for (let b of bid) {
            if (b.accepted) {
                return false;
            }
        }
        return true;
    };

    getStatus(jobStatusLog) {
        // [owner, expired, budget, cancel, status, freelancer]
        let bidAccepted = jobStatusLog[5] !== '0x0000000000000000000000000000000000000000';
        const stt = {
            started: Number(jobStatusLog[4].toString()) === 1,
            completed: Number(jobStatusLog[4].toString()) === 2,
            claimed: Number(jobStatusLog[4].toString()) === 5,
            reject: Number(jobStatusLog[4].toString()) === 4,
            disputing: Number(jobStatusLog[4].toString()) === 6,
            paymentAccepted: Number(jobStatusLog[4].toString()) === 9,
            canceled: jobStatusLog[3],
            bidAccepted: bidAccepted,
            bidding: this.getBiddingStt(jobStatusLog),
            expired: false,
            waiting: !this.getBiddingStt(jobStatusLog) && !bidAccepted,
        };
        if (stt.started || stt.completed || stt.claimed || stt.reject || stt.paymentAccepted || stt.disputing) {
            stt.bidAccepted = false;
        }
        return stt;
    }

    getStatusJob = all => {
        // console.log(all);
        if (all.canceled) {
            return ['Canceled'];
        } else if (all.expired) {
            return ['Expired'];
        } else if (all.bidding) {
            return ['Bidding'];
        } else if (all.bidAccepted) {
            return ['Bid Accepted'];
        } else if (all.started) {
            return ['In Progress'];
        } else if (all.completed) {
            return ['Completed'];
        } else if (all.paymentAccepted) {
            return ['Payment Accepted'];
        } else if (all.reject) {
            return ['Rejected'];
        } else if (all.disputing) {
            return ['Disputing'];
        } else if (all.claimed) {
            return ['Claimed'];
        } else if (all.waiting) {
            return ['Waiting'];
        }
    };

    getBiddingStt(stts) {
        // [owner, expired, budget, cancel, status, freelancer]
        if (stts[3]) {
            return false;
        } else if (Number(stts[1].toString()) <= Math.floor(Date.now() / 1000)) {
            return false;
        } else if (stts[5] !== '0x0000000000000000000000000000000000000000') {
            return false;
        }
        return true;
    }

    avgBid = bids => {
        let total = 0;
        if (bids.length > 0) {
            for (let b of bids) {
                total += Number(b.award);
            }
            if (!Number.isInteger(total / bids.length)) {
                return (total / bids.length).toFixed(2);
            }
            return total / bids.length;
        } else {
            return NaN;
        }
    };

    async connectMetaMask(web3, ignoreNetwork = ['MAINNET']) {
        if (!web3) {
            throw new Error(
                JSON.stringify({
                    code: 'INSTALL',
                    message: 'You need to install Metamask first!',
                })
            );
        } else {
            let [err, netId] = await this.callMethod(web3.version.getNetwork)();
            if (err) {
                throw new Error(
                    JSON.stringify({
                        code: 'NETWORK',
                        message: err,
                    })
                );
            } else if (ignoreNetwork.includes(this.getNetwork(netId))) {
                throw new Error(
                    JSON.stringify({
                        code: 'CONNECT_NETWORK',
                        message: 'Please choose TESTNET',
                    })
                );
            } else {
                let [err, accounts] = await this.callMethod(web3.eth.getAccounts)();
                if (err) {
                    throw new Error(
                        JSON.stringify({
                            code: 'NETWORK',
                            message: err,
                        })
                    );
                } else {
                    if (accounts.length > 0) {
                        return {
                            account: web3.eth.defaultAccount,
                            network: netId,
                        };
                    } else {
                        throw new Error(
                            JSON.stringify({
                                code: 'CONNECT_WALLET',
                                message: 'Please login Metamask!',
                            })
                        );
                    }
                }
            }
        }
    }

    isWalletAddress(walletAddress) {
        const regexWalletAdress = /^(0x)?[0-9a-f]{40}$/i;
        return walletAddress ? regexWalletAdress.test(walletAddress.trim()) : false;
    }

    toAscii(hex) {
        // Find termination
        var str = '';
        var i = 0,
            l = hex.length;
        if (hex.substring(0, 2) === '0x') {
            i = 2;
        }
        for (; i < l; i += 2) {
            var code = parseInt(hex.substr(i, 2), 16);
            if (code === 0) {
                break;
            }
            str += String.fromCharCode(code);
        }
        return str;
    }

    currencyFormat(value) {
        value = Number(value);
        if (!Number.isInteger(value)) {
            value = value.toFixed(2);
        }
        return value.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
    }

    convertDateTime(timestamp) {
        const dateTime = new Date(timestamp);
        // Create an array with the current month, day and time
        const date = [dateTime.getMonth() + 1, dateTime.getDate(), dateTime.getFullYear()];
        // Create an array with the current hour, minute and second
        const time = [dateTime.getHours(), dateTime.getMinutes(), dateTime.getSeconds()];
        // Determine AM or PM suffix based on the hour
        const suffix = time[0] < 12 ? 'AM' : 'PM';
        // Convert hour from military time
        time[0] = time[0] < 12 ? time[0] : time[0] - 12;
        // If hour is 0, set it to 12
        time[0] = time[0] || 12;
        // If seconds and minutes are less than 10, add a zero
        for (let i = 1; i < 3; i++) {
            if (time[i] < 10) {
                time[i] = '0' + time[i];
            }
        }
        // Return the formatted string
        return date.join('/') + ' ' + time.join(':') + ' ' + suffix;
    }

    removeDuplicates(myArr, prop) {
        return myArr.filter((obj, pos, arr) => {
            return arr.map(mapObj => mapObj[prop]).indexOf(obj[prop]) === pos;
        });
    }

    BBOToWei(web3, value) {
        return Number(web3.toWei(value, 'ether'));
    }

    WeiToBBO(web3, value) {
        return Number(web3.fromWei(value, 'ether'));
    }

    setCookie(cname, cvalue, exdays) {
        let d = new Date();
        d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
        const expires = 'expires=' + d.toUTCString();
        document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/';
    }

    getCookie(cname) {
        const name = cname + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) === 0) {
                return c.substring(name.length, c.length);
            }
        }
        return '';
    }

    makeIdString(length) {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
    }

    makeIdNumber(length) {
        let text = '';
        const possible = '0123456789';
        for (let i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
    }

    toWidth(a, b) {
        return a / ((a + b) / 100);
    }

    findPerWidth(value, object) {
        const arr = Object.values(object);
        const max = Math.max(...arr);
        if (max > 0) {
            return (value / max) * 100 + '%';
        }
        return '0%';
    }

    copyStringToClipboard(str) {
        var el = document.createElement('textarea');
        el.value = str;
        el.setAttribute('readonly', '');
        el.style = { position: 'absolute', left: '-9999px' };
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    }

    isEmail(email) {
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return email ? re.test(String(email).toLowerCase()) : false;
    }

    getURLParam(param) {
        const url = new URL(window.location.href);
        return url.searchParams.get(param);
    }

    secondsToHours(seconds) {
        const hours = Number(seconds) / 60 / 60;
        return hours;
    }

    // convert web3 0.2x function event to promise
    WaitAllContractEventGet = function(myevent) {
        return new Promise(function(resolve, reject) {
            myevent.get(function(error, logs) {
                if (error !== null) {
                    reject(error);
                }
                resolve(logs);
            });
        });
    };

    // filter object by max value of key
    filterObjectArrayByMax = (arr, key) => {
        return arr.reduce(function(l, e) {
            return e[key] > l[key] ? e : l;
        });
    };
}

export default new Utils();
