'use strict'
const Hashids = require('hashids/cjs')
const hashids = new Hashids("one-time-secret", 2, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
const Encryption = use('Encryption')
const Redis = use('Redis')
const captcha = require('trek-captcha')
const ts = Date.now()

class SecretController {
    async GetCaptcha({ request, response }) {
        const { token, buffer } = await captcha()
        let hash = Encryption.encrypt(token)
        await Redis.set(ts, hash)
        return response.send(buffer, 'tracker.gif')

    }
    async GetForm({ request, response, session, view }) {
        return view.render('welcome', { ts })
    }
    async PostSecret({ request, response, session }) {
        const host = request.headers().origin
        const { secret, captcha, ts } = request.all()
        let hash = await Redis.get(ts)
        let solution = Encryption.decrypt(hash)

        if (captcha != solution) {
            session.flash({ secret: secret})
            session.flash({ error: 'Captcha does not match.  Please Try Again'})
            return response.redirect('back')
        } 
        Redis.del(ts)
        const id = await Redis.get('hits')
        const urlStr = hashids.encode(Number(id))
        const secMesg = Encryption.encrypt(secret)
        await Redis.set(urlStr, secMesg)
        session.flash({ success: `${host}/l/${urlStr}` })
        return response.redirect('back')
    }

    async GetSecret({ view, params }) {
        const id = params.id
        // Get our secret message
        let mesg = await Redis.get(id)
        // Immediately delete our secret  message
        await Redis.del(id)
        mesg = Encryption.decrypt(mesg)
        if (mesg != null){
            return view.render('secret', {mesg, valid: 1})
        } else {
            return view.render('secret', { valid: 0})
        }
    }
}

module.exports = SecretController
