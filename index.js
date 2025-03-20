const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const chalk = require('chalk');
const { generateCSV, saveToCSV } = require('./src/pdd/utils');
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
async function crawlJDOrders() {
    // Get command line arguments
    const args = process.argv.slice(2);
    const yearArg = args.find(arg => arg.startsWith('--years='));
    const years = yearArg ? parseInt(yearArg.split('=')[1]) : 1; // Default to 1 year if not specified
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null
    });

    const page = await browser.newPage();
    
    // 访问京东登录页
    await page.goto('https://passport.jd.com/new/login.aspx');
    
    // 等待用户手动完成登录，因为京东有复杂的验证码和滑块
    console.log(chalk.yellow('请在浏览器中手动完成登录...'));
    // 根据url 改变判断登录
    await waitForLogin(page);
    
    console.log(chalk.green('登录成功'));
    // 跳转到订单页面
    await page.goto('https://order.jd.com/center/list.action');
    
    // Collect orders based on specified years
    let allOrders = [];
    try {
        for (let i = 1; i <= years; i++) {
            const result = await getOrderData(page, i);
            const yearLabel = i === 1 ? '今年' : dayjs().subtract(i-1, 'year').format('YYYY');
            console.log(chalk.cyan(`${yearLabel}数据: ${result.orders.length} 条，共 ${result.pageCount} 页`));
            allOrders = [...allOrders, ...result.orders];
        }
    } catch (error) {
        console.error(chalk.red('获取订单数据失败:'), error);
    }
    
    // 保存订单数据到CSV文件
    const filePath = saveOrdersToCSV(allOrders);
    // 总共报错
    console.log(chalk.green(`总共保存: ${allOrders.length}`));
    console.log(chalk.green(`订单数据已保存到: ${filePath}`));
    await browser.close();
}

// 引入工具函数

// 新增函数：保存订单数据到CSV文件
function saveOrdersToCSV(orders) {
    // 使用新的抽象函数
    const csvContent = generateCSV(orders, {
        transforms: {
            totalPrice: price => price.replace('¥', '')
        }
    });
    
    return saveToCSV(csvContent, 'jd');
}

// index 为0 最近三个月
// index 为1 今年
// index 为2 去年
// index 为3 前年
// index 为4 前年以前
async function getOrderData(page, index) {
    try {
        // 等待下拉框元素加载完成
        await page.waitForSelector('.ordertime-cont');
        
        // 点击下拉框选择"今年"选项
        await page.click('.ordertime-cont .time-txt');
        console.log(chalk.blue('点击下拉框 选择时间'));
        await page.waitForSelector('.time-list li');
        
        const ctn = await page.evaluate((index) => {
            const items = document.querySelectorAll('.time-list li a');
            let i = 0;
            let ctn = '';
            //根据index 选择对应的选项
            for (let item of items) {
                if (i === index) {
                    item.click();
                    // 打印在node环境怎么
                    ctn = item.textContent;
                    break;
                }
                i++;
            }
            return ctn;
        }, index);
        console.log(chalk.blue('选择下拉框'), chalk.cyan(ctn));

        // 等待表格数据加载
        await page.waitForSelector('.order-tb');
        console.log(chalk.blue('表格数据加载完成'));

        let allOrders = [];
        let hasNextPage = true;
        let pageCount = 0;
        
        while (hasNextPage) {
            pageCount++; // Increment page counter
            
            // 等待表格数据加载完成
            await page.waitForSelector('tbody[id^="tb-"]');
            
            // 提取当前页订单数据
            const pageOrders = await page.evaluate(() => {
                const orderRows = document.querySelectorAll('tbody[id^="tb-"]');
                return Array.from(orderRows).map(row => {
                    return {
                        orderId: row.querySelector('[name="orderIdLinks"]')?.textContent.trim() || '',
                        orderTime: row.querySelector('.dealtime')?.getAttribute('title') || '',
                        totalPrice: row.querySelector('.amount span:first-child')?.textContent.trim().replace('¥', '') || '',
                        status: row.querySelector('.order-status')?.textContent.trim() || '',
                        name: row.querySelector('.p-name .a-link')?.textContent.trim() || ''
                    };
                });
            });

            allOrders = allOrders.concat(pageOrders);

            // 检查是否有下一页
            hasNextPage = await page.evaluate(() => {
                const nextBtn = document.querySelector('.next-disabled');
                return !nextBtn; // 如果没有找到禁用的下一页按钮，说明还有下一页
            });

            // console.log('是否还有下一页',hasNextPage, '当前页数:', pageCount);
            if (hasNextPage) {
                // 点击下一页按钮
                await page.waitForSelector('.pagin .next');
                
                // 随机等待2-5秒再翻页
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 3000));
                
                // 使用page.evaluate来执行点击,避免弹出新窗口
                await page.evaluate(() => {
                    document.querySelector('.pagin .next').click();
                });
                console.log(chalk.blue('点击下一页'));
                
                // 等待新   页面加载完成
                await page.waitForNavigation({
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });
               
            }
        }

        // 过滤掉已取消的订单 退款成功
        const filteredOrders = allOrders.filter(order => order.status !== '已取消' && order.status !== '退款成功');

        return {
            orders: filteredOrders,
            pageCount: pageCount
        };
    } catch (error) {
        console.error(chalk.red('获取订单数据失败:'), error);
        return {
            orders: [],
            pageCount: 0
        };
    }
}

// 运行爬虫
crawlJDOrders().catch(error => console.error(chalk.red('爬虫运行出错:'), error));
