import matplotlib.pyplot as plt
import torch
import numpy as np
from PIL import Image
from torchvision import transforms
from torchvision.models import resnet50
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import StepLR
import sys
import os
import time
import copy

class ScreenDataset(torch.utils.data.Dataset):
    def __init__(self, filenames, xmin=-1, xmax=-1, ymin=-1, ymax=-1):
        self.preprocess = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        self.xmin = xmin
        self.xmax = xmax
        self.ymin = ymin
        self.ymax = ymax
        self.filenames = filenames

    def __len__(self):
        return len(self.filenames)

    def __getitem__(self, item):
        img = Image.open(self.filenames[item])
        if self.xmin > 0 and self.xmax > 0 and self.ymin > 0 and self.ymax > 0:
            img = img.crop((self.xmin, self.ymin, self.xmax, self.ymax))
        return self.filenames[item], self.preprocess(img)

if __name__ == "__main__":
    model_filepath = '' # model filepath, eg: 'weights/classifier.pth'
    image_filenames = [] # list of image filepaths, eg ["images/Cornwall_Crinnis/clear/2022_01_28_15_07.jpg", "images/Cornwall_Crinnis/blocked/2022_02_08_16_08.jpg"]
    xmin = -1 # coordinates of the trash screen window (-1 if no window), eg 10
    xmax = -1 # 235
    ymin = -1 # 10
    ymax = -1 # 235
    threshold = 0.5 # blockage threshold value (between 0 and 1)

    batch_size = 10

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

    dataset = ScreenDataset(image_filenames, xmin, xmax, ymin, ymax)
    dataloader = torch.utils.data.DataLoader(dataset, batch_size=batch_size, shuffle=False)

    model = resnet50()
    num_ftrs = model.fc.in_features
    model.fc = nn.Linear(num_ftrs, 2)

    model.to(device)
    model.load_state_dict(torch.load(model_filepath, map_location=device))
    model.eval()
    softmax = nn.Softmax(dim=1)

    for filenames, images in dataloader:
        images = images.to(device)
        predictions = softmax(model(images)).detach()
        for i in range(len(filenames)):
            label = "blocked" if predictions[i, 1].item() > threshold else "clear"
            print(f"{filenames[i]}: {label}")
