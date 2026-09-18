# -*- coding: utf-8 -*-
"""
国铁实时信息屏 - 后端服务
参考项目: CRSim (https://github.com/denglihong2007/CRSim)
API来源: 12306-wechat-apis (https://github.com/CyrilSLi/12306-wechat-apis)
"""

import requests
import json
import os
from datetime import datetime, timedelta, timezone
from flask import Flask, render_template, jsonify, request, g

# 北京时间时区 UTC+8
BJT = timezone(timedelta(hours=8))

def now_bjt():
    """获取当前北京时间"""
    return datetime.now(BJT)

app = Flask(__name__)

# 12306 API 基础地址
API_BASE = "https://mobile.12306.cn/wxxcx"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MicroMessenger/8.0.40.2400(0x28002835) Process/wechat",
    "Referer": "https://servicewechat.com/wx12ecc3a9b4d1be79/123/page-frame.html",
    "Content-Type": "application/x-www-form-urlencoded",
}

# 铁路局代码映射
BUREAU_MAP = {
    "A": "新广铁", "B": "哈局", "C": "呼局", "D": "锦局", "E": "新成局",
    "F": "郑局", "G": "南局", "H": "上局", "I": "济局", "J": "兰局",
    "K": "济局", "L": "吉局", "M": "昆局", "N": "武局", "O": "青藏铁",
    "P": "京局", "Q": "广铁", "R": "乌局", "S": "福局", "T": "沈局",
    "U": "新上局", "V": "太局", "W": "成局", "X": "境外", "Y": "西局", "Z": "宁局"
}

# 缓存机制
cache = {
    "stations": None,        # 车站列表缓存
    "station_trains": {},    # 各车站车次缓存 {station_code: {"time": timestamp, "data": [...]}}
    "car_detail": {},        # 担当车底缓存 {train_code: data}
}

CACHE_DURATION = 60  # 缓存60秒


def load_stations():
    """加载车站电报码数据"""
    if cache["stations"] is not None:
        return cache["stations"]
    
    stations_file = os.path.join(app.static_folder, "data", "stations.json")
    if os.path.exists(stations_file):
        with open(stations_file, "r", encoding="utf-8") as f:
            cache["stations"] = json.load(f)
    else:
        cache["stations"] = {}
    return cache["stations"]


def api_post(url):
    """调用12306 POST接口"""
    try:
        resp = requests.post(url, headers=HEADERS, timeout=10)
        resp.encoding = "utf-8"
        return resp.json()
    except Exception as e:
        print(f"API请求失败: {e}")
        return {"data": [], "error": str(e)}


def api_get(url):
    """调用12306 GET接口"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.encoding = "utf-8"
        return resp.json()
    except Exception as e:
        print(f"API请求失败: {e}")
        return {"data": None, "error": str(e)}


@app.route("/")
def index():
    """主页面"""
    station = request.args.get("station", "GZQ")  # 默认广州站
    return render_template("index.html", default_station=station)


@app.route("/api/regions")
def get_regions():
    """获取省市区车站数据"""
    regions_file = os.path.join(app.static_folder, "data", "stations_region.json")
    if os.path.exists(regions_file):
        with open(regions_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify({"data": data})
    return jsonify({"data": {}})


@app.route("/api/stations")
def get_stations():
    """获取车站列表（搜索）"""
    keyword = request.args.get("q", "").strip()
    stations = load_stations()
    
    if not keyword:
        # 返回常用车站
        common = ["BJP", "SHH", "GZQ", "GZCN", "SXN", "NKH", "VNP", "TJP", "WHN", "XAO", "CSQ", "CDW", "HFH", "HGH", "NJH", "FHH", "NCH", "ZZF", "JNK", "QDK", "DLC", "SYT", "CCB", "HBD", "LJP", "JQB", "KMM", "LZZ", "YJK", "WCB", "TYY", "JBO", "LLP", "WWA", "BHP", "TLO", "HHC", "NNZ", "ZQJ", "SWZ", "XMS", "FZS", "JRS", "KZJ", "DZG", "GZN", "BXQ", "QYW", "HOH", "HHC", "DLG", "WFK", "YKB", "JIK", "LHG", "SNK", "TJT", "JNQ", "TKP", "DLH", "YKB", "ZJK"]
        result = []
        for code in common:
            if code in stations:
                result.append({"code": code, "name": stations[code]})
        return jsonify({"data": result})
    
    # 搜索匹配
    result = []
    for code, name in stations.items():
        if keyword in name or keyword.upper() == code:
            result.append({"code": code, "name": name})
            if len(result) >= 20:
                break
    return jsonify({"data": result})


@app.route("/api/trains")
def get_trains():
    """获取指定车站的车次大屏数据"""
    station_code = request.args.get("station", "GZQ")
    date_str = now_bjt().strftime("%Y%m%d")
    
    # 检查缓存
    cache_key = f"{station_code}_{date_str}"
    if cache_key in cache["station_trains"]:
        cached = cache["station_trains"][cache_key]
        if now_bjt().timestamp() - cached["time"] < CACHE_DURATION:
            return jsonify(cached["data"])
    
    # 调用12306车站车次大屏接口
    url = f"{API_BASE}/wechat/bigScreen/queryTrainByStation?train_start_date={date_str}&train_station_code={station_code}"
    result = api_post(url)
    
    trains = []
    if "data" in result and result["data"]:
        stations = load_stations()
        now = now_bjt()
        current_time_min = now.hour * 60 + now.minute
        
        for item in result["data"]:
            # 过滤出有有效到达时间的车次
            arrive_time_str = item.get("arrive_time", "")
            start_time_str = item.get("start_time", "")
            
            if not arrive_time_str or not all(c.isdigit() for c in arrive_time_str.replace(":", "")):
                continue
            
            # 解析时间
            try:
                arrive_parts = arrive_time_str.split(":")
                arrive_min = int(arrive_parts[0]) * 60 + int(arrive_parts[1])
            except:
                continue
            
            start_min = None
            if start_time_str and all(c.isdigit() for c in start_time_str.replace(":", "")):
                try:
                    start_parts = start_time_str.split(":")
                    start_min = int(start_parts[0]) * 60 + int(start_parts[1])
                except:
                    pass
            
            # 判断车次类型：始发、过路、终到
            # 正确逻辑：看列车的始发站/终到站是不是当前站
            start_station_name = item.get("start_station_name", "")
            end_station_name = item.get("end_station_name", "")
            current_station_name = item.get("station_name", station_code)
            
            is_origin = (start_station_name == current_station_name)
            is_terminal = (end_station_name == current_station_name)
            
            # 计算与当前时间的差（分钟）
            time_diff = arrive_min - current_time_min
            if time_diff < -30:  # 已过30分钟以上的车次不显示
                continue
            
            train_info = {
                "train_code": item.get("station_train_code", ""),
                "train_no": item.get("train_no", ""),
                "start_station": item.get("start_station_name", ""),
                "end_station": item.get("end_station_name", ""),
                "arrive_time": arrive_time_str,
                "start_time": start_time_str if start_time_str and start_time_str != "00:00" else "",
                "bureau_code": item.get("bureau_code", ""),
                "bureau_name": BUREAU_MAP.get(item.get("bureau_code", ""), ""),
                "train_type": item.get("train_type_name", ""),
                "train_style": item.get("train_style", ""),
                "station_name": item.get("station_name", station_code),
                "time_diff": time_diff,
                "train_category": "origin" if is_origin else ("terminal" if is_terminal else "pass"),
            }
            trains.append(train_info)
        
        # 按时间排序
        trains.sort(key=lambda x: x["time_diff"])
    
    response_data = {
        "station_code": station_code,
        "station_name": trains[0]["station_name"] if trains else station_code,
        "update_time": now_bjt().strftime("%Y-%m-%d %H:%M:%S"),
        "trains": trains
    }
    
    # 更新缓存
    cache["station_trains"][cache_key] = {
        "time": now_bjt().timestamp(),
        "data": response_data
    }
    
    return jsonify(response_data)


@app.route("/api/train_detail")
def get_train_detail():
    """获取车次停站详情"""
    train_no = request.args.get("train_no", "")
    train_date = request.args.get("date", now_bjt().strftime("%Y%m%d"))
    
    if not train_no:
        return jsonify({"data": []})
    
    url = f"{API_BASE}/wechat/ticketInfo/getStopStation?train_no={train_no}&train_date={train_date}"
    result = api_post(url)
    
    return jsonify(result)


@app.route("/api/weather")
def get_weather():
    """获取车站天气"""
    station_code = request.args.get("station", "")
    
    if not station_code:
        return jsonify({"data": None})
    
    url = f"{API_BASE}/wechat/weather/total?stationCode={station_code}&type=forcast&version=v2"
    result = api_get(url)
    
    return jsonify(result)


if __name__ == "__main__":
    import sys
    import threading
    import webbrowser

    # PyInstaller打包后的资源路径处理
    if getattr(sys, 'frozen', False):
        base_dir = sys._MEIPASS
        app.static_folder = os.path.join(base_dir, "static")
        app.template_folder = os.path.join(base_dir, "templates")
    else:
        os.makedirs(os.path.join(app.static_folder, "data"), exist_ok=True)
        os.makedirs("templates", exist_ok=True)
    
    print("=" * 50)
    print("  国铁实时信息屏系统")
    print("  参考: CRSim + 12306-wechat-apis")
    print("=" * 50)
    print(f"  访问地址: http://localhost:5000")
    print(f"  默认车站: 广州站 (GZQ)")
    print("=" * 50)
    
    # 自动打开浏览器
    def open_browser():
        webbrowser.open("http://localhost:5000")
    threading.Timer(1.5, open_browser).start()
    
    app.run(host="0.0.0.0", port=5000, debug=False)
"}]