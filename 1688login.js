const puppeteer = require('puppeteer');
const chalk = require('chalk');
const { generateCSV, saveToCSV } = require('./src/pdd/utils');

// 检测登录状态的函数
async function waitForLogin(page, timeout = 300000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('登录超时'));
        }, timeout);

        const checkLogin = async () => {
            console.log(chalk.blue('检查登录状态...'));
            
            // 通过URL或页面元素判断是否登录成功
            const isLoggedIn = await page.evaluate(() => {
                // 检查是否存在登录后才会出现的元素
                const usernameElement = document.querySelector('.login-form')
                                    
                // 检查URL是否不再包含login
                const notInLoginPage = !page.url().includes('login');
                
                return usernameElement && notInLoginPage;
            });

            if (isLoggedIn) {
                clearTimeout(timer);
                console.log(chalk.green('登录成功!'));
                resolve();
                return;
            }
            setTimeout(checkLogin, 1000);
        };

        checkLogin();
    });
}

async function login1688() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null
    });

    // 创建初始页面
    const page = await browser.newPage();
    
    try {
        // 1. 访问1688登录页
        console.log(chalk.blue('正在打开1688.com...'));
        await page.goto('https://air.1688.com/app/ctf-page/trade-order-list/buyer-order-list.html?page=1&pageSize=10');
        
        const newActivePagePromise = new Promise(async (resolve, reject) => {
            browser.on('targetchanged', async (target) => {
                if(target.url().includes('login')){
                    resolve(target.page());
                }
            });
        });
        // 点击登录按钮
         // 点击登录按钮
         await page.evaluate(() => {
            const loginBtn = document.querySelectorAll('span[data-spm="login-text"]');
            for(let btn of loginBtn){
                btn.click();
                break;
            }
        });
        
        // 等待新页面打开并获取它的引用
       
         // 点击登录按钮
        const newActivePage = await newActivePagePromise;
        console.log(newActivePage, 'newActivePage');
        
        // 判断页面是跳转到
        await new Promise(async (resolve, reject) => {
            const checkUrlChange = async () => {
                const currentUrl = await newActivePage.url();
                if (currentUrl.includes('air.1688.com')) {
                    clearTimeout(timer);
                    resolve();
                    return;
                }
                setTimeout(checkUrlChange, 1000);
            };

            const timer = setTimeout(() => {
                reject(new Error('Login timeout'));
            }, 300000);

            checkUrlChange();
        });
        console.log(chalk.green('跳转成功...'));
        // newActivePage.on('console', async (message) => {
        //     console.log(message.text(), '页面message');
        // });
       
        const popup = await newActivePage.locator('.driver-popover-close-btn');
        if (popup) {
            await popup.click();
            console.log(chalk.green('关闭弹窗...'));
        }
      
        // 开始爬页面数据
        const data = await newActivePage.evaluate(() => {
            // 获取元素，<order-item ></order-item>
            const dom = document.querySelector("body > article > app-root").shadowRoot.querySelector("div > main > q-theme > order-list").shadowRoot
            

            const footer = dom.querySelectorAll('order-list-footer');
            const list = dom.querySelectorAll('order-item');
            const listData = [];
            for(let item of list){
                // const header = item.shadowRoot.querySelector('order-item-header');
                // const content = item.shadowRoot.querySelector('order-item-content');
                const orderId = item.shadowRoot.querySelector('.order-id-action').innerText
                const orderTime = item.shadowRoot.querySelector('.order-time').innerText;
                const orderPrice = item.shadowRoot.querySelector('order-item-total-price').shadowRoot.querySelector('.total-price').innerText;
                const orderStatus = item.shadowRoot.querySelector('order-item-status').shadowRoot.querySelector('.order-status').innerText;
                const entry = item.shadowRoot.querySelector('order-item-entry-product')
                const des = entry.shadowRoot.querySelector('.product-name').innerText
                
                // const orderStatus = header.querySelector('order-item-status').innerText;
                // const orderId = content.querySelector('order-item-order-id').innerText;
                // const orderPrice = content.querySelector('order-item-price').innerText;
                // const orderTotal = content.querySelector('order-item-total').innerText;
                //  ['orderId', 'orderTime', 'totalPrice', 'status', 'name']
                listData.push({orderId, orderTime, totalPrice: orderPrice.replace('¥', ''), status: orderStatus, name: des});
            }
            return listData;
        });
        const csvContent = generateCSV(data);
        const filePath = saveToCSV(csvContent, 'alibaba1688');
        console.log(chalk.green('数据已保存到:'), filePath);
        console.log(data, 'data');
        
        // 
        // const url = await newActivePage.url();
        // console.log(chalk.green('新页面tile',t,url));
        // // 2. 等待用户在新页面完成登录
        // console.log(chalk.yellow('请在浏览器中手动完成登录(包括验证码/滑块验证)...'));
        // const newWindowTarget = await browser.waitForTarget(
        //     target => {
        //         if(target.url().includes('login')){
        //             return true;
        //         }
        //         return false;
        //     },
        // );
        // const newWindowTargetPage = await newWindowTarget.page();
        // newWindowTargetPage.bringToFront();
        // console.log(chalk.green('新页面选择...'));
        // console.log(newWindowTargetPage);
        // const newPage = await newPagePromise;
        // await waitForLogin(newPage.page());

    

    
      
        
        
        // 这里可以添加提取订单数据的代码
        
        console.log(chalk.blue('程序执行完成，请在完成操作后手动关闭浏览器'));
        
    } catch (error) {
        console.error(chalk.red('程序出错:'), error);
    }
    
    // 保持浏览器打开，让用户可以看到结果
    // 如果需要自动关闭，取消下面这行的注释
    // await browser.close();
}

// 运行程序
login1688().catch(error => console.error(chalk.red('程序执行出错:'), error)); 