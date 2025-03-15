const dayjs = require('dayjs');

/**
 * 将时间戳转换为格式化日期
 * @param {number} timestamp - 秒级时间戳
 * @param {string} format - 格式化模板，默认 'YYYY-MM-DD HH:mm:ss'
 * @returns {string} 格式化后的日期字符串
 */
function formatTimestamp(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
    return dayjs(timestamp * 1000).format(format);
}

module.exports = {
    formatTimestamp
};