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
        let allData = [];
        let currentPage = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            console.log(chalk.blue(`正在获取第 ${currentPage} 页数据...`));
            
            // 等待页面加载完成
            await new Promise(r => setTimeout(r, 2000));
            
            // 获取当前页数据
            const pageData = await newActivePage.evaluate(() => {
                // 获取元素，<order-item ></order-item>
                const dom = document.querySelector("body > article > app-root").shadowRoot.querySelector("div > main > q-theme > order-list").shadowRoot;
                
                // 判断是否有下一页
                const footer = dom.querySelector('order-list-footer').shadowRoot;
                const pagination = footer.querySelector('q-pagination').shadowRoot;
                const ulPagination = pagination.querySelector('lu-pagination').shadowRoot;
                const nextBtn = ulPagination.querySelector('.ui-page.ui-page-next');
                const hasNext = !nextBtn.disabled;
                
                // 获取当前页数据
                const list = dom.querySelectorAll('order-item');
                const listData = [];
                for (let item of list) {
                    const orderId = item.shadowRoot.querySelector('.order-id-action').innerText;
                    const orderTime = item.shadowRoot.querySelector('.order-time').innerText;
                    const orderPrice = item.shadowRoot.querySelector('order-item-total-price').shadowRoot.querySelector('.total-price').innerText;
                    const orderStatus = item.shadowRoot.querySelector('order-item-status').shadowRoot.querySelector('.order-status').innerText;
                    const entry = item.shadowRoot.querySelector('order-item-entry-product');
                    const des = entry.shadowRoot.querySelector('.product-name').innerText;
                    
                    listData.push({
                        orderId, 
                        orderTime, 
                        totalPrice: orderPrice.replace('¥', ''), 
                        status: orderStatus, 
                        name: des
                    });
                }
                
                // 如果可以点击下一页，就点击
                if (hasNext) {
                    nextBtn.click();
                }
                
                return {
                    data: listData,
                    hasNext: hasNext
                };
            });
            
            // 将当前页数据添加到总数据中
            allData = [...allData, ...pageData.data];
            
            // 打印当前页数据
            console.log(chalk.cyan(`第 ${currentPage} 页共 ${pageData.data.length} 条数据:`));
            pageData.data.forEach((item, index) => {
                console.log(chalk.white(`  ${index + 1}. ${item.name} - ${item.orderTime} - ¥${item.totalPrice} - ${item.status}`));
            });
            
            // 判断是否有下一页
            hasNextPage = pageData.hasNext;
            if (hasNextPage) {
                console.log(chalk.yellow(`准备加载第 ${currentPage + 1} 页...`));
                currentPage++;
            } else {
                console.log(chalk.green(`所有 ${currentPage} 页数据加载完成!`));
            }
        }
        
        console.log(chalk.green(`总共获取 ${allData.length} 条数据`));
        
        // 生成并保存CSV
        const csvContent = generateCSV(allData);
        const filePath = saveToCSV(csvContent, 'alibaba1688');
        console.log(chalk.green('数据已保存到:'), filePath);
        
        // 这里可以添加提取订单数据的代码
        
        console.log(chalk.blue('程序执行完成，请在完成操作后手动关闭浏览器'));
        
    } catch (error) {
        console.error(chalk.red('程序出错:'), error);
    }
    
    // 保持浏览器打开，让用户可以看到结果
    // 如果需要自动关闭，取消下面这行的注释
    await browser.close();
}

// 运行程序
login1688().catch(error => console.error(chalk.red('程序执行出错:'), error)); 