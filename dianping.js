const puppeteer = require('puppeteer');
const chalk = require('chalk');
const { generateCSV, saveToCSV } = require('./src/pdd/utils');

const BASE_URL = 'https://www.dianping.com/shop/';
const OUTPUT_FILE = 'dianping-data.csv';

let browser;
// Helper function for login waiting
async function waitForLogin(page, timeout = 300000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Login timeout'));
        }, timeout);

        const checkLogin = async () => {
            if (!page.url().includes('login')) {
                clearTimeout(timer);
                resolve();
                return;
            }
            setTimeout(checkLogin, 1000);
        };

        checkLogin();
    });
}
async function initBrowser() {
    browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null
    });
}

async function login() {
    const page = await browser.newPage();
    await page.goto('https://m.dianping.com/');
    await page.waitForSelector('.self-outline-wrapper');
    await page.click('.self-outline-wrapper');
    await page.waitForSelector('.login-box');
    console.log(chalk.green('跳转登录页面'));
    await waitForLogin(page);
    return page;
   
    console.log(chalk.green('登录成功'));
}
async function goDianpingPC(page) {
    await page.goto('https://t.dianping.com/account/daocan_orders');
    // 等待加载完成
    await page.waitForSelector('.um-con');
}
async function crawlMyOrderList(page) {
    await page.goto('https://m.dianping.com/nmy/myinfo');
}

async function main() {
    try {
        console.log(chalk.green('开始爬取大众点评订单'));
        await initBrowser();

        const page = await login();
        await goDianpingPC(page);

        
        await crawlMyOrderList(page);
    } catch (error) {
        console.error(chalk.red('爬取大众点评订单失败'), error);
    } finally {
        console.log(chalk.green('爬取大众点评订单完成'));
        // await browser.close();
    }
}

main();

