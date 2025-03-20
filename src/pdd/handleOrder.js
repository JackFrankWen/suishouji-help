const chalk = require('chalk');

/**
 * 获取订单数据
 * @param {Page} page - Puppeteer页面实例
 * @returns {Promise<Array>} 订单数据数组
 */
/**
 * 获取订单数据
 * @param {Page} page - Puppeteer页面实例
 * @returns {Promise<Array>} 订单数据数组
 * @description 
 * 1. 等待订单列表加载完成
 * 2. 延迟2秒确保数据加载
 * 3. 滚动到页面底部加载所有订单
 * 4. 提取并返回订单数据
 * 5. 如果出错则返回空数组
 */
async function getOrderData(page) {
    try {
        // 等待订单列表加载
        await page.waitForSelector('.deal-list-status-new');
        // 延迟2秒,确保数据完全加载
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        // 打印加载完成提示
        console.log(chalk.blue('ℹ'), '订单列表加载完成');

        // 滚动到底部加载所有订单
        await scrollToBottom(page);
        // 提取并返回订单数据
        return await extractOrderData(page);
    } catch (error) {
        // 出错时打印错误信息并返回空数组
        console.error(chalk.red('✗'), chalk.red('获取订单数据失败:'), error);
        return [];
    }
}

/**
 * 滚动到页面底部直到加载完所有订单
 * @param {Page} page - Puppeteer页面实例
 */
async function scrollToBottom(page) {
    let hasMoreOrders = true;
    while (hasMoreOrders) {
        await page.evaluate(() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
        });

        console.log(chalk.yellow('⟳'), '滚动加载中...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const isBottom = await page.evaluate(() => {
            const noMoreText = document.querySelector('.loading-text');
            return noMoreText && noMoreText.textContent.includes('您已经没有更多的订单了');
        });

        if (isBottom) {
            hasMoreOrders = false;
            console.log(chalk.green('✓'), '已到达底部，数据加载完成');
        }
    }
}

/**
 * 提取页面中的订单数据
 * @param {Page} page - Puppeteer页面实例
 * @returns {Promise<Array>} 订单数据数组
 */
async function extractOrderData(page) {
    return await page.evaluate(() => {
        const listElement = document.querySelector('.react-base-list');
        const orders = [];

        // 循环获取列表中的数据
        for (const item of listElement.children) {
            try {
                // 通过层级关系定位价格元素: 第4个div下的第2个div下的第2个p的内容
                const priceElement = item.children[2].children[1].querySelectorAll('p')[1];
                const statusElement = item.querySelector('p[data-test="订单状态"]');
                const nameElement = item.querySelector('span[data-test="商品名称"]');

                if (!statusElement || !nameElement) {
                    console.log('某些元素未找到，跳过此订单');
                    continue;
                }

                orders.push({
                    totalPrice: priceElement.textContent.trim().replace('¥', '') || '',
                    status: statusElement.textContent.trim(),
                    name: nameElement.textContent.trim()
                });
            } catch (error) {
                console.log('处理订单时出错:', error);
                continue;
            }
        }
        return orders;
    });
}

module.exports = {
    getOrderData
};
