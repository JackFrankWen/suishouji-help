const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * 保存订单数据到CSV文件
 * @param {string} csvContent - CSV内容
 * @returns {string} 文件路径
 */
function saveToCSV(csvContent) {
    try {
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 10) + '-' +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0');
        // 存到当前目录/csv目录下
        const filePath = path.join(process.cwd(), 'csv', `pdd-orders-${timestamp}.csv`);
        fs.writeFileSync(filePath, csvContent);
        console.log(chalk.green('✓'), chalk.green(`文件已保存到: ${filePath}`));
        return filePath;
    } catch (error) {
        console.error(chalk.red('✗'), chalk.red('保存订单数据失败:'), error);
    }
}

/**
 * 将数据保存为CSV格式
 * @param {Array} orders - 订单数据数组
 * @returns {string} CSV格式的字符串
 */
function generateCSV(orders) {
    const headers = ['订单号', '下单时间', '订单总价', '订单状态', '商品名称'];
    const rows = [headers];

    orders.forEach(order => {
        rows.push([
            order.orderId,
            order.orderTime,
            order.totalPrice.replace('¥', ''),
            order.status,
            order.name
        ]);
    });

    console.log(chalk.blue('ℹ'), chalk.blue(`处理订单数据: ${orders.length} 条`));
    return rows.map(row => row.join(',')).join('\n');
}

module.exports = {
    saveToCSV,
    generateCSV
}; 