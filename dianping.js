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
  // 定义移动设备配置
  const mobileDevice = {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    viewport: {
      width: 375,
      height: 812,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: false,
      isLandscape: false,
    },
  };

  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
    ],
  });
}

async function login() {
  const page = await browser.newPage();

  // 设置移动设备 User-Agent
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  );

  // 添加反自动化检测
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  await page.goto('https://m.dianping.com/');
  await page.waitForSelector('.self-outline-wrapper');
  await page.click('.self-outline-wrapper');
  await page.waitForSelector('.login-box');
  console.log(chalk.green('跳转登录页面'));
  await waitForLogin(page);
  return page;
}

async function goDianpingPC(page) {
  await page.goto('https://t.dianping.com/account/daocan_orders');
  let allData = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    console.log(chalk.blue(`正在获取堂食订单第 ${currentPage} 页数据...`));
    
    // 等待表格加载完成
    await page.waitForSelector('.con-list table tbody');
    
    // 获取当前页数据
    const pageData = await page.evaluate(() => {
      const list = document.querySelectorAll('.con-list table tbody tr');
      const listData = [];
      
      for (let item of list) {
        try {
          const orderPrice = item.querySelector('.t-price span')?.textContent.trim() || '';
          const orderTime = item.querySelector('.t-time span')?.textContent.trim() || '';
          const description = item.querySelector('.t-order .txt h4 a')?.textContent.trim() || '';
          const orderStatus = item.querySelector('.t-status div')?.textContent.trim() || '';
          const orderId = item.querySelector('.t-order .txt h5 span')?.textContent.trim() || '';
          
          if (orderPrice && orderTime && description) {
            listData.push({
              totalPrice: orderPrice.replace('¥', ''),
              orderTime,
              name:description,
              status:orderStatus,
              orderId: orderId.replace('订单号：', ''),
            });
          }
        } catch (err) {
          console.error('解析行数据失败:', err);
        }
      }
      
      // 检查是否有下一页按钮且不是禁用状态
      const nextBtn = document.querySelector('.NextPage');
      const isNextBtnDisabled = nextBtn ? nextBtn.classList.contains('disabled') : true;
      
      return {
        data: listData,
        hasNext: !isNextBtnDisabled && nextBtn !== null
      };
    });
    
    // 将当前页数据添加到总数据中
    allData = [...allData, ...pageData.data];
    
    // 打印当前页数据
    console.log(chalk.cyan(`第 ${currentPage} 页共 ${pageData.data.length} 条数据`));
    pageData.data.forEach((item, index) => {
      console.log(chalk.white(`  ${index + 1}. ${item.name} - ${item.orderTime} - ¥${item.totalPrice} - ${item.status}`));
    });
    
    // 判断是否有下一页
    hasNextPage = pageData.hasNext;
    if (hasNextPage) {
      // 点击下一页
      await page.click('.NextPage');
      // 等待页面加载
      currentPage++;
    } else {
      console.log(chalk.green(`堂食订单数据加载完成，共 ${currentPage} 页`));
    }
  }
  
  return allData;
}

async function crawlMyOrderList(page) {
  await page.goto('https://t.dianping.com/account/orders');
  let allData = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    console.log(chalk.blue(`正在获取团购订单第 ${currentPage} 页数据...`));
    
    // 等待表格加载完成
    await page.waitForSelector('.con-list table tbody');
    
    // 获取当前页数据
    const pageData = await page.evaluate(() => {
      const list = document.querySelectorAll('.con-list table tbody tr');
      const listData = [];
      
      for (let item of list) {
        try {
          const orderPrice = item.querySelector('.t-price span')?.textContent.trim() || '';
          const orderTime = item.querySelector('.t-time span')?.textContent.trim() || '';
          const description = item.querySelector('.t-order .txt h4')?.textContent.trim() || '';
          const orderStatus = item.querySelector('.t-status div')?.textContent.trim() || '';
          const orderId = item.querySelector('.t-order .txt h5 span')?.textContent.trim() || '';
        
          if (orderPrice && orderTime && description) {
            //         fields = ['orderId', 'orderTime', 'totalPrice', 'status', 'name'],
            listData.push({
              totalPrice: orderPrice.replace('¥', ''),
              orderTime,
              name:description,
              status:orderStatus,
              orderId: orderId.replace('订单号：', ''),
            });
          }
        } catch (err) {
          console.error('解析行数据失败:', err);
        }
      }
      
      // 检查是否有下一页按钮且不是禁用状态
      const nextBtn = document.querySelector('.NextPage');
      const isNextBtnDisabled = nextBtn ? nextBtn.classList.contains('disabled') : true;
      
      return {
        data: listData,
        hasNext: !isNextBtnDisabled && nextBtn !== null
      };
    });
    
    // 将当前页数据添加到总数据中
    allData = [...allData, ...pageData.data];
    
    // 打印当前页数据
    console.log(chalk.cyan(`第 ${currentPage} 页共 ${pageData.data.length} 条数据`));
    pageData.data.forEach((item, index) => {
      console.log(chalk.white(`  ${index + 1}. ${item.name} - ${item.orderTime} - ¥${item.totalPrice} - ${item.status}`));
    });
    
    // 判断是否有下一页
    hasNextPage = pageData.hasNext;
    if (hasNextPage) {
      // 点击下一页
      await page.click('.NextPage');
      // 等待页面加载
      currentPage++;
    } else {
      console.log(chalk.green(`团购订单数据加载完成，共 ${currentPage} 页`));
    }
  }
  
  return allData;
}

async function main() {
  try {
    console.log(chalk.green('开始爬取大众点评订单'));
    await initBrowser();

    const page = await login();
    
    // 获取团购订单
    console.log(chalk.yellow('\n开始获取团购订单...'));
    const grouponOrders = await crawlMyOrderList(page);
    
    // 获取堂食订单
    console.log(chalk.yellow('\n开始获取堂食订单...'));
    const dineInOrders = await goDianpingPC(page);
    
    // 合并所有订单
    const allOrders = [...grouponOrders, ...dineInOrders];
    console.log(chalk.green(`\n总共获取 ${allOrders.length} 条订单数据`));
    
    // 保存数据
    const csvContent = generateCSV(allOrders);
    const filePath = saveToCSV(csvContent, 'dianping');
    console.log(chalk.green('数据已保存到:'), filePath);
    
  } catch (error) {
    console.error(chalk.red('爬取大众点评订单失败'), error);
  } finally {
    console.log(chalk.green('爬取大众点评订单完成'));
    await browser.close();
  }
}

main();
