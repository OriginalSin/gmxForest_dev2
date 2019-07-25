#-*-coding:utf-8-*-
from __future__ import print_function
from __future__ import with_statement
import requests
from datetime import datetime


# sample group requests data
params_list = { "groupRequest" : [
    {"quadrantLayerId":"","reportType":"об использовании лесов","organizationName":"Наименование организации",
     "inn":'1234567890',"region":"Тверская область","forestry":"Западнодвинское","sectionForestry":"Алексапольское",
     "quadrant":"95","stratum":"1,22","fellingForm":"","fellingType":"","recoveryEventType":"",
     "siteArea":"4.9","scale":"","site":"1","featureID":'25',
     "satLayers":[{"layerId":"636CBFF5155F4F299254EAF54079040C","type":"оптическая","system":"Sentinel-2",
                   "resolution":"10 м","beginDate":1539820800,"endDate":1539820801}],
     "layerID":"0B8A43060C734E6FB28E9B063DEA31C6"},

    {"quadrantLayerId":"","reportType":"об использовании лесов","organizationName":"Наименование организации",
     "inn":"1234567890","region":"Тверская область","forestry":"Западнодвинское",
     "quadrant":"97","stratum":"4,5","fellingForm":"","fellingType":"","recoveryEventType":"",
     "siteArea":"Площадь","scale":"","site":"1","featureID":28,
     "satLayers":[{"layerId":"636CBFF5155F4F299254EAF54079040C","type":"оптическая","system":"Sentinel-2",
                   "resolution":"10 м","beginDate":1539820800,"endDate":1539820801}],
     "layerID":"0B8A43060C734E6FB28E9B063DEA31C6"},

    {"quadrantLayerId":"","reportType":"об использовании лесов","organizationName":"Наименование организации",
     "inn":"1234567890","region":"Тверская область","forestry":"Западнодвинское",
     "quadrant":"58","stratum":"20,22","fellingForm":"","fellingType":"","recoveryEventType":"",
     "siteArea":"Площадь","scale":"","site":"1","featureID":41,
     "satLayers":[{"layerId":"636CBFF5155F4F299254EAF54079040C","type":"оптическая","system":"Sentinel-2",
                   "resolution":"10 м","beginDate":1533772800,"endDate":1533772801}],
     "layerID":"0B8A43060C734E6FB28E9B063DEA31C6"},

    {"quadrantLayerId":"","reportType":"об использовании лесов","organizationName":"Наименование организации",
     "inn":"1234567890","region":"Тверская область","forestry":"Западнодвинское",
     "quadrant":"66","stratum":"13","fellingForm":"","fellingType":"","recoveryEventType":"",
     "siteArea":"Площадь","scale":"","site":"1","featureID":57,
     "satLayers":[{"layerId":"636CBFF5155F4F299254EAF54079040C","type":"оптическая","system":"Sentinel-2",
                   "resolution":"10 м","beginDate":1529020800,"endDate":1529020801}],
     "layerID":"0B8A43060C734E6FB28E9B063DEA31C6"}
]}


if __name__ == '__main__':
    start_time = datetime.now()

    url = 'http://lesfond.tk/rest/v1/getimages'
    r = requests.post(url, json=params_list)
    if r.status_code == 200:
        with open("result.zip", "wb") as zpf:
            zpf.write(r.content)
    else:
        print('<FAILED>.Response code: {}'.format(r.status_code))

    print(datetime.now() - start_time)


