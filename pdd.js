const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { getOrderData } = require('./src/pdd/handleOrder');
const { saveToCSV, generateCSV } = require('./src/pdd/utils');
const chalk = require('chalk');

let responseData = [];
let count = 0;

async function crawlPDDOrders() {
    // 获取命令行参数
    const args = process.argv.slice(2);
    const yearArg = args.find(arg => arg.startsWith('--years='));
    const years = yearArg ? parseInt(yearArg.split('=')[1]) : 1; // 默认获取1年的数据

    console.log(chalk.blue('ℹ'), chalk.blue(`准备获取最近 ${years} 年的订单数据`));

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            devtools: true
        });

        const page = await browser.newPage();
        
        // Improved request/response handling
        await page.setRequestInterception(true);
        page.on('request', request => request.continue());
        
        page.on('response', async response => {
            const url = response.url();
            if (url.includes('/proxy/api/api/aristotle/order_list_v4')) {
                try {
                    const responseBody = await response.json();
                    if (responseBody?.orders) {
                        count++;
                        console.log(chalk.blue(`获取第${count}页数据`));
                        responseData = responseData.concat(responseBody.orders);
                    }
                } catch (error) {
                    console.error('Failed to parse response:', error);
                }
            }
        });

        // Improved login handling with timeout
        await page.goto('https://mobile.yangkeduo.com/login.html');
        console.log(chalk.yellow('⚠'), chalk.yellow('请手动登录...'));
        
        await waitForLogin(page);
        console.log(chalk.green('✓'), chalk.green('登录成功'));

        // try {
        //     // 等待页面跳转完成
        //     await page.waitForNavigation({
        //         waitUntil: 'domcontentloaded',
        //         timeout: 3000
        //     });
        // } catch (error) {
        //     console.log('等待页面跳转完成失败');
        // }

        console.log('加载完成');
        try {
            // promise.race 等待3秒
            await page.waitForSelector('.footer-items')
            await page.evaluate(() => {
                const footerItems = document.querySelectorAll('.footer-item');
                footerItems.forEach((item, index) => {
                    if (index === 4) { // 个人中心是第5个item
                        item.click();
                    }
                });
            });
        } catch (error) {
            console.log('没有找到.footer-items元素 个人中心');
        }


        // 检查是否有取消按钮 如果有则点击
        try {
            const cancelBtn = await page.waitForSelector('.alert-goto-app-cancel', { timeout: 5000 });
            if (cancelBtn) {
                await cancelBtn.click();
            }
        } catch (error) {
            console.log('没有找到取消按钮,继续执行...');
        }

        // 检查是否成功跳转到订单页面，如果没有则重试点击
        let retryCount = 0;
        const maxRetries = 3;

        while (!page.url().includes('orders.html') && retryCount < maxRetries) {
            console.log(`尝试跳转到订单页面，第 ${retryCount + 1} 次`);
            try {
                await page.waitForSelector('.others');
                await page.evaluate(() => {
                    const othersElement = document.querySelector('.others');
                    if (othersElement) {
                        othersElement.click();
                    }
                });

            } catch (error) {
                console.log('点击全部订单按钮失败:', error.message);
            }
            retryCount++;
            // 短暂等待后再次尝试
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!page.url().includes('orders.html')) {
            console.log('无法跳转到订单页面，请检查页面状态');
        } else {
            console.log('成功跳转到订单页面');
            // 等待页面加载完成
            try {
                await page.waitForNavigation({
                    waitUntil: 'domcontentloaded',
                    timeout: 5000
                }); 
            } catch (error) {
                console.log('orders.html加载失败');
            }
            // 写个方法 监控当前window中dom是否在变化
        }

        // Improved order data processing
        if (page.url().includes('orders.html')) {
            const rawData = await page.evaluate(() => window.rawData || {});
            const newOrders = rawData.ordersStore?.orders || [];

            const ordersList = newOrders.map(order => ({
                totalPrice: order.orderAmount.replace('¥', ''),
                status: order.orderStatusPrompt,
                name: order.orderGoods.map(goods => goods.goodsName).join(','),
                orderTime: dayjs(order.orderTime * 1000).format('YYYY-MM-DD HH:mm:ss'),
                orderId: order.trackingNumber
            }));
            

            const htmlOrders = await getOrderData(page);
            
            console.log(chalk.blue('ℹ'), `总订单数: ${htmlOrders.length}`);
            // responseData= responseData.filter(order => order.order_status_prompt.includes('交易成功'));
            responseData = responseData.map(order => {
                const orderGoods = order.order_goods || [];
                if (orderGoods.length > 0) {
                    const orderName = orderGoods.map(goods => goods.goods_name).join(',');
                    const orderId = orderGoods.map(goods => goods.goods_id).join(',');
                    const priceElement = htmlOrders.find(o => o.name === orderName);
                    return {
                        totalPrice: priceElement?.totalPrice.replace('¥', ''),
                        status: order.order_status_prompt,
                        name: orderName,
                        orderTime: dayjs(order.order_time * 1000).format('YYYY-MM-DD HH:mm:ss'),
                        orderId: orderId
                    };
                } else {
                    // Handle case where order_goods does not exist
                    return {
                        totalPrice: '0',
                        status: order.order_status_prompt,
                        name: 'No goods',
                        orderTime: dayjs(order.order_time * 1000).format('YYYY-MM-DD HH:mm:ss'),
                        orderId: ''
                    };
                }
               
            })
            // 过滤掉未发货，退款成功的订单
            responseData = responseData.filter(order => 
                !order.status.includes('未发货') && 
                !order.status.includes('拼单未成功')
            );

            // 根据年份过滤订单
            const startDate = dayjs().subtract(years, 'year').format('YYYY-MM-DD HH:mm:ss');
            const endDate = dayjs().format('YYYY-MM-DD HH:mm:ss');

            responseData = responseData.filter(order => 
                order.orderTime >= startDate && 
                order.orderTime <= endDate
            );

            console.log(chalk.blue('ℹ'), `过滤后的订单数: ${responseData.length}`);
            console.log(chalk.blue('ℹ'), `时间范围: ${startDate} 至 ${endDate}`);

            const finalData = [...ordersList, ...responseData];
            console.log(chalk.blue('ℹ'), `最终数据: ${finalData.length} 条`);
            const csvContent = generateCSV(finalData);
            const filePath = saveToCSV(csvContent);
            console.log(chalk.green('✓'), `订单数据已保存到: ${filePath}`);
        }
    } catch (error) {
        console.error(chalk.red('✗'), chalk.red('爬取失败:'), error);
    } finally {
        if (browser) {
            await browser.close();
            console.log(chalk.green('✓'), '浏览器已关闭');
        }
    }
}

// Helper function for login waiting
async function waitForLogin(page, timeout = 300000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Login timeout'));
        }, timeout);

        const checkLogin = async () => {
            if (!page.url().includes('login.html')) {
                clearTimeout(timer);
                resolve();
                return;
            }
            setTimeout(checkLogin, 1000);
        };

        checkLogin();
    });
}

// 运行爬虫
crawlPDDOrders().catch(console.error); 