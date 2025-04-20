<template>
  <div class="map-container">
    <div class="map" id="container"></div>
    <div class="panel-container">
      <button @click="togglePanel" class="toggle-button">
        <i v-if="isPanelVisible" class="fa-solid fa-angle-up"></i>
        <i v-else class="fa-solid fa-angle-down"></i>
      </button>
      <div id="panel" v-show="isPanelVisible"></div> 
    </div>
  </div>
  <ConfirmDialog
    :is-visible="showLocationDialog"
    title="位置服务"
    message="是否允许使用IP定位服务来获取您的位置？"
    @confirm="handleLocationConfirm"
    @cancel="handleLocationCancel"
  />
</template>

<script>
import ConfirmDialog from './ConfirmDialog.vue'

export default {
  name: 'AMapContainer',
  components: {
    ConfirmDialog
  },
  props: {
    coordinates: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      map: null,
      placeSearch: null,
      infoWindow: null,
      markers: [],
      showLocationDialog: false,
      defaultCenter: [114.3055, 30.5928],
      driving: null,
      isPanelVisible: false // 默认收起面板
    }
  },
  watch: {
    coordinates: {
      handler(newCoordinates) {
        if (newCoordinates.length >= 2) {
          this.planRoute(newCoordinates)
        }
      },
      deep: true
    }
  },
  mounted() {
    // 设置安全密钥和代理服务器
    window._AMapSecurityConfig = {
      serviceHost: 'http://localhost:3000/_AMapService'
    }

    // 动态加载高德地图脚本
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'http://localhost:3000/api/amap/init'
    script.onload = () => {
      this.showLocationDialog = true
    }
    document.head.appendChild(script)
  },
  methods: {
    handleLocationConfirm() {
      this.showLocationDialog = false
      this.initMap(true)
    },
    handleLocationCancel() {
      this.showLocationDialog = false
      this.initMap(false)
    },
    initMap(useIpLocation) {
      const mapOptions = {
        resizeEnable: true,
        zoom: 12,
        isHotspot: true,
        mapStyle: "amap://styles/light"
      }
      
      if (!useIpLocation) {
        mapOptions.center = this.defaultCenter
      }
      
      this.map = new AMap.Map('container', mapOptions)

      // 确保地图初始化完成后再初始化其他服务
      this.map.on('complete', () => {
        this.placeSearch = new AMap.PlaceSearch()
        this.infoWindow = new AMap.InfoWindow({
          offset: new AMap.Pixel(0, -50)
        })

        // 初始化驾车导航服务
        AMap.plugin(['AMap.Driving'], () => {
          this.driving = new AMap.Driving({
            map: this.map,
            panel: 'panel'
          })
        })

        this.setupMapEvents()
      })
    },
    setupMapEvents() {
      this.map.on('hotspotclick', async (result) => {
        try {
          const details = await new Promise((resolve, reject) => {
            this.placeSearch.getDetails(result.id, (status, result) => {
              if (status === 'complete' && result.info === 'OK') {
                resolve(result)
              } else {
                reject(new Error('Failed to get details'))
              }
            })
          })
          this.handlePlaceSearchCallback(details)
        } catch (error) {
          console.error('Error getting place details:', error)
        }
      })

      this.map.on('click', (e) => {
        const marker = new AMap.Marker({
          position: e.lnglat,
          map: this.map
        })
        this.markers.push(marker)

        const mapContainerHeight = document.getElementById('container').offsetHeight
        if (e.pixel.y > mapContainerHeight / 2) {
          this.map.panBy(0, -300, 1000)
        }

        setTimeout(() => {
          marker.setMap(null)
          this.markers.pop()
        }, 2000)
      })
    },
    handlePlaceSearchCallback(data) {
      const poiArr = data.poiList.pois
      if (poiArr[0]) {
        const location = poiArr[0].location
        const poiInfo = `${poiArr[0].name}(${poiArr[0].address})`
        
        this.infoWindow.setContent(this.createContent(poiArr[0]))
        this.infoWindow.open(this.map, location)
        
        // 将事件名改为 send-message，直接触发消息发送
        this.$emit('send-message', poiInfo)
      }
    },
    createContent(poi) {
      const s = []
      s.push(`<div class="info-title">${poi.name}</div><div class="info-content">地址：${poi.address}`)
      s.push(`电话：${poi.tel}`)
      s.push(`类型：${poi.type}`)
      s.push('<div>')
      return s.join('<br>')
    },
    // 添加路径规划方法
    planRoute(coordinates) {
      if (!this.driving || coordinates.length < 2) {
        console.log('驾车规划初始化失败或坐标点不足');
        return;
      }

      console.log('开始驾车规划，坐标点：', coordinates);
      const start = new AMap.LngLat(coordinates[0].lng, coordinates[0].lat);
      const end = new AMap.LngLat(coordinates[coordinates.length - 1].lng, coordinates[coordinates.length - 1].lat);
      
      // 构建途经点数组
      const waypoints = coordinates.slice(1, -1).map(coord => {
        return new AMap.LngLat(coord.lng, coord.lat);
      });

      this.driving.search(start, end, {
        waypoints: waypoints
      }, (status, result) => {
        if (status === 'complete') {
          console.log('驾车规划成功，路径数据：', result);
        } else {
          console.error('驾车规划失败：', result);
        }
      });
    },
    togglePanel() {
      this.isPanelVisible = !this.isPanelVisible;
    }
  }
}
</script>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.map {
  width: 100%;
  height: 100%;
}

.panel-container {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.toggle-button {
  width: 30px; 
  height: 30px; 
  padding: 0; 
  cursor: pointer;
  background-color: #ffffff;
  border: none;
  border-radius: 50%; /* 设置为圆形 */
  font-size: 16px; /* 调整图标大小 */
  color: #333;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-button:focus {
  outline: none;
}
.toggle-button:hover {
  background-color: #f5f5f5;
  transform: translateY(-1px);
}

#panel {
  width: 250px;
  max-height: 80vh;
  overflow-y: auto;
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  opacity: 1;
  transform: translateX(0);
}

#panel[style*="display: none"] {
  opacity: 0;
  transform: translateX(20px);
}
.info-content img {
  float: left;
  margin: 3px;
}

.amap-info-combo .keyword-input {
  height: auto;
}

.amap-info-content amap-info-outer {
  color: #000000;
}

/* 修改高德地图信息窗体的默认样式 */
:deep(.amap-info-content) {
  background-color: #ffffff;
  color: #000000;
}

:deep(.amap-info-content .info-title) {
  font-weight: bolder;
  color: #111010;
  font-size: 14px;
  width: 250px;
  line-height: 26px;
  padding: 0 0 0 6px;
}

:deep(.amap-info-content .info-content) {
  width: 250px ;
  padding: 4px ;
  color: #000000 ;
  line-height: 20px ;
  font: 12px Helvetica, 'Hiragino Sans GB', 'Microsoft Yahei', '微软雅黑', Arial ;
  background-color: #ffffff ;
}
:deep(.amap-copyright) {
  color: #000000 ;
  font:  Helvetica, 'Hiragino Sans GB', 'Microsoft Yahei', '微软雅黑', Arial ;
}

.amap-info-content amap-info-outer{
  color: #000000;
}

:deep(.amap-geolocation) {
  top: 10px;
  /* right: 10px;  调整，避免与新面板容器重叠 */
  right: 280px; /* 根据面板宽度调整 */
  bottom: auto;
  left: auto;
}
</style>