import request from './request'
import {
    getAccountFromWIF,
    buildContractTransactionData,
    buildClaimTransactionData,
    buildRawTransaction,
    signTransactionData
} from '../crypto'
import { getTokenBalanceScript, buildInvocationTransactionData } from '../crypto/nep5'
import { reverse } from '../crypto/utils'

export function getBalance(address) {
    var path = '/api/main_net/v1/get_balance/' + address

    function findAsset(balance,asset) {
        var token = balance.find((item) => {
            return item.asset === asset;
        });
        token = token==null?{amount:0,unspent:[]}:token;
        return token;
    }

    return request(path).then(response => {
        try {
            console.log('in get balance');
            var balance = response.balance;
            var neo = findAsset(balance,'NEO')
            var gas = findAsset(balance,'GAS');

            if (neo.amount == undefined || gas.amount == undefined || neo.unspent == undefined || gas.unspent == undefined) {
                throw new TypeError()
            }

            return { Neo: neo.amount, Gas: gas.amount, unspent: { Neo: neo.unspent, Gas: gas.unspent } }
        } catch (error) {
            if (error instanceof TypeError) {
                throw new Error('Return data malformed')
            } else {
                throw new Error(error)
            }
        }
    })
}

export function getWalletDBHeight() {
    var path = '/api/main_net/v1/get_height'
    return request(path).then(response => {
        let height = parseInt(response.height)
        if (isNaN(height)) {
            throw new Error('Return data malformed')
        }

        return height
    })
}

export function getTransactionHistory(address) {
    var path = '/api/main_net/v1/get_claimed/' + address
    return request(path).then(response => {
        try {
            console.log('get trans history');
            if (response.claimed == undefined || !(response.claimed instanceof Array)) {
                throw new TypeError()
            }
            if (response.claimed) return response.claimed
        } catch (error) {
            if (error instanceof TypeError) {
                throw new Error('Return data malformed')
            } else {
                throw new Error(error)
            }
        }
    })
}

export function getClaimAmounts(address) {
    var path = '/api/main_net/v1/get_claimable/' + address
    return request(path).then(response => {
        let available = parseInt(response.unclaimed)
        let unavailable = 0;//parseInt(response.total_unspent_claim)

        if (isNaN(available) || isNaN(unavailable)) {
            throw new Error('Return data malformed')
        }

        return { available: available, unavailable: unavailable }
    })
}

export function getAssetId(assetType) {
    // more info here: http://docs.neo.org/en-us/node/api/getbalance.html
    const neoId = 'c56f33fc6ecfcd0c225c4ab356fee59390af8560be0e930faebe74a6daff7c9b'
    const gasId = '602c79718b16e442de58778e148d0b1084e3b2dffd5de6b7b16cee7969282de7'

    let assetId
    if (assetType === 'Neo') {
        assetId = neoId
    } else {
        assetId = gasId
    }
    return assetId
}

/**
 * Send an asset to an address
 * @param {string} destinationAddress - The destination address.
 * @param {string} WIF - The WIF of the originating address.
 * @param {string} assetType - The Asset. 'Neo' or 'Gas'.
 * @param {number} amount - The amount of asset to send.
 * @return {Promise<Response>} RPC Response
 */
export function sendAsset(destinationAddress, WIF, assetType, amount) {
    let assetId = getAssetId(assetType)
    const fromAccount = getAccountFromWIF(WIF)

    return getBalance(fromAccount.address).then(response => {
        const UTXOs = response.unspent[assetType]
        const txData = buildContractTransactionData(UTXOs, assetId, fromAccount.publicKeyEncoded, destinationAddress, amount)
        const signature = signTransactionData(txData, fromAccount.privateKey)
        const rawTXData = buildRawTransaction(txData, signature, fromAccount.publicKeyEncoded)

        return queryRPC('sendrawtransaction', [rawTXData.toString('hex')], 4)
    })
}

function getRPCEndpoint() {
    return 'https://neo-privnet-rpc.ngrok.io';
    // var path = '/v2/network/best_node'
    //
    // return request(path).then(response => {
    //     return response.node
    // })
}

export const queryRPC = (method, params, id = 1) => {
    const jsonRpcData = { method, params, id, jsonrpc: '2.0' }
    console.log(jsonRpcData);
    var rpcEndpoint = getRPCEndpoint();
    var options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(jsonRpcData)
    }
    return request(rpcEndpoint, options, true).then(response => {
        return response
    })
}

export function claimAllGAS(fromWif) {
    const account = getAccountFromWIF(fromWif)

    var path = '/api/main_net/v1/get_claimable/' + account.address
    return request(path).then(response => {
        const claims = response['claims']
        const totalClaim = response['total_claim']

        const txData = buildClaimTransactionData(claims, totalClaim, account.publicKeyEncoded)
        const signature = signTransactionData(txData, account.privateKey)
        const rawTXData = buildRawTransaction(txData, signature, account.publicKeyEncoded)
        return queryRPC('sendrawtransaction', [rawTXData.toString('hex')], 2)
    })
}

export function getMarketPriceUSD() {
    let fullURL = 'https://bittrex.com/api/v1.1/public/getticker?market=USDT-NEO'
    let options = {}
    let OVERRIDE_BASE_URL = true

    return request(fullURL, options, OVERRIDE_BASE_URL).then(response => {
        try {
            if (response.result.Last == undefined) {
                throw new TypeError()
            }
            return response.result.Last
        } catch (error) {
            if (error instanceof TypeError) {
                throw new Error('Return data malformed')
            } else {
                throw new Error(error)
            }
        }
    })
}

export function getWalletDataFrom(url) {
    let options = {}
    let OVERRIDE_BASE_URL = true
    return request(url, options, OVERRIDE_BASE_URL).then(response => {
        try {
            data = {}
            data.scrypt = response.scrypt
            data.accounts = response.accounts.map(acc => {
                return { key: acc.key, label: acc.label }
            })
            return data
        } catch (error) {
            throw new Error('Wallet format invalid or corrupt')
        }
    })
}

/**
 * Get the balance of a NEP5 Token
 * @param {String} token hash (hex)
 * @param {String} public address of account to check token balance of
 * @returns {int} token abalance
 */

export function getTokenBalance(token, address) {
    const NETWORK_STORAGE_MULTIPLIER = 100000000
    return queryRPC('invokescript', [getTokenBalanceScript(token, address).toString('hex')], 2).then(response => {
        let valueBuf = Buffer.from(response.result.stack[0].value, 'hex')
        let value = parseInt(reverse(valueBuf).toString('hex'), 16) / NETWORK_STORAGE_MULTIPLIER

        if (isNaN(value)) {
            value = 0
        }
        return value
    })
}

/**
 *
 * @param {string} destinationAddress - The destination address.
 * @param {string} WIF - The WIF of the originating address.
 * @param {string} token - token scripthash (hex string).
 * @param {number} amount - of tokens to sent
 * @return {Promise<Response>} RPC Response
 */
export function SendNEP5Asset(destinationAddress, WIF, token, amount) {
    let assetId = getAssetId('Gas')
    const fromAccount = getAccountFromWIF(WIF)

    return getBalance(fromAccount.address).then(response => {
        const UTXOs = response.unspent['Gas']
        const txData = buildInvocationTransactionData(UTXOs, assetId, fromAccount.publicKeyEncoded, destinationAddress, amount, token)
        console.log(txData.toString('hex'))
        const signature = signTransactionData(txData, fromAccount.privateKey)
        const rawTXData = buildRawTransaction(txData, signature, fromAccount.publicKeyEncoded)

        return queryRPC('sendrawtransaction', [rawTXData.toString('hex')], 4)
    })
}
