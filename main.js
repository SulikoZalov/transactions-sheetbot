import { Telegraf, Composer, Scenes, session } from "telegraf";
import { google } from "googleapis";
import 'dotenv/config';

const bot = new Telegraf(process.env.TELEGRAM_KEY);

const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: "https://www.googleapis.com/auth/spreadsheets"
})

const client = await auth.getClient();

const googleSheets = google.sheets({ version: "v4", auth: client });

const spreadsheetId = process.env.SPREAD_SHEET_ID;

const metaData = await googleSheets.spreadsheets.get({ auth, spreadsheetId });

const getRows = await googleSheets.spreadsheets.values.get({ auth, spreadsheetId, range: "Transactions" });

let date = new Date(Date.now()).toLocaleDateString();

const addComment = new Composer();
addComment.on('text', (ctx) => {
    ctx.reply("Оставьте комментарий");
    ctx.wizard.state.data = {};

    return ctx.wizard.next();
})

const addSum = new Composer();
addSum.on('text', (ctx) => {
    ctx.wizard.state.data.note = ctx.message.text;

    if(!ctx.wizard.state.data.note){
        ctx.reply("Комментарий должен быть заполнен")

        return ctx.wizard.back();
    }

    ctx.reply("Введите сумму");

    return ctx.wizard.next();
})

const chooseCategory = new Composer();
chooseCategory.on('text', (ctx) => {
    ctx.wizard.state.data.sum = Number(ctx.message.text)

    if(!ctx.wizard.state.data.sum){
        ctx.reply("Сумма должна быть числом")

        return ctx.wizard.back();
    }
    ctx.reply("Выберите категорию", {
        reply_markup: {
            inline_keyboard: [
                [
                    {text: "Продукты", callback_data: "Продукты"},
                    {text: "Спорт", callback_data: "Спорт"}
                ]
            ]
        }
    })

    return ctx.wizard.next();
})

const chooseCard = new Composer();
chooseCard.on('callback_query', (ctx) => {
    ctx.answerCbQuery();
    ctx.wizard.state.data.category = ctx.callbackQuery.data;

    ctx.reply("Выберите карту или счёт", {
        reply_markup: {
            inline_keyboard: [
                [ { text: "Наличные", callback_data: "Наличные" } ],
                [ { text: "ABB", callback_data: "ABB" } ],
                [ { text: "Unibank", callback_data: "Unibank" } ],
                [ { text: "Kapital Bank", callback_data: "Kapital Bank" } ],
                [ { text: "Leobank", callback_data: "Leobank" } ]
            ]
        }
    })

    return ctx.wizard.next();
})

const writeData = new Composer();
writeData.on('callback_query', async (ctx) => {
    ctx.answerCbQuery();
    ctx.wizard.state.data.card = ctx.callbackQuery.data;

    await googleSheets.spreadsheets.values.append({
        auth,
        spreadsheetId,
        range: "Transactions!A1",
        valueInputOption: "USER_ENTERED",
        resource: {
            values: [
                [
                    date,
                    ctx.wizard.state.data.note,
                    ctx.wizard.state.data.sum,
                    ctx.wizard.state.data.category,
                    ctx.wizard.state.data.card
                ]
            ]
        }
    })

    ctx.reply("Транзакция записана успешно!")

    return ctx.scene.leave();

})

const transactionScene = new Scenes.WizardScene('transaction', addComment, addSum, chooseCategory, chooseCard, writeData);


const stage = new Scenes.Stage([transactionScene]);
bot.use(session());
bot.use(stage.middleware());

bot.command('addtransaction', async (ctx) => ctx.scene.enter('transaction'));

bot.launch();


