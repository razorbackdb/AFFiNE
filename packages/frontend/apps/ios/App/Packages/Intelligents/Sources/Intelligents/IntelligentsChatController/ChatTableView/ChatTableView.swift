//
//  ChatTableView.swift
//  Intelligents
//
//  Created by 秋星桥 on 2024/11/18.
//

import UIKit

class ChatTableView: UIView {
  let tableView = UITableView()

  var dataSource: [DataElement] = []

  init() {
    super.init(frame: .zero)

    for eachCase in DataElement.CellType.allCases {
      let cellClass = eachCase.cellClassType
      tableView.register(cellClass, forCellReuseIdentifier: eachCase.cellIdentifier)
    }

    tableView.backgroundColor = .clear

    tableView.delegate = self
    tableView.dataSource = self
    addSubview(tableView)

    tableView.translatesAutoresizingMaskIntoConstraints = false
    [
      tableView.topAnchor.constraint(equalTo: topAnchor),
      tableView.leadingAnchor.constraint(equalTo: leadingAnchor),
      tableView.trailingAnchor.constraint(equalTo: trailingAnchor),
      tableView.bottomAnchor.constraint(equalTo: bottomAnchor),
    ].forEach { $0.isActive = true }

    let foot = UIView()
    foot.translatesAutoresizingMaskIntoConstraints = false
    foot.heightAnchor.constraint(equalToConstant: 200).isActive = true
    foot.widthAnchor.constraint(equalToConstant: 200).isActive = true
    tableView.tableFooterView = foot

    tableView.separatorStyle = .none

    putMockData()
  }

  @available(*, unavailable)
  required init?(coder _: NSCoder) {
    fatalError()
  }
}

extension ChatTableView {
  func putMockData() {
    DispatchQueue.main.async {
      self.dataSource = [
        .init(type: .chat, object: ChatCell.ViewModel(
          participant: .system,
          markdownDocument: "Welcome to Intelligents"
        )),
        .init(type: .chat, object: ChatCell.ViewModel(
          participant: .user,
          markdownDocument: "Please summarize this article for me"
        )),
        .init(type: .chat, object: ChatCell.ViewModel(
          participant: .assistant,
          markdownDocument: ###"""
          **Activation Code Usage Limits**

          A single activation code can be used on multiple devices.

          **Note:** A single activation code is intended for use on a reasonable number of devices by one user.

          Excessive activation requests may result in the activation code being banned. Any bans are subject to manual review and are operated by staff.

          `The limit is up to 5 devices per year or 10 activation requests within the same period.`
          """###
        )),
        .init(type: .chat, object: ChatCell.ViewModel(
          participant: .user,
          markdownDocument: ###"""
          **Download Axchange from the App Store**

          You can download Axchange from the App Store:

          - [https://apps.apple.com/app/axchange-adb-file-transfer/id6737504944](https://apps.apple.com/app/axchange-adb-file-transfer/id6737504944)

          The version downloaded this way does not require activation to use.
          """###
        )),
        .init(type: .chat, object: ChatCell.ViewModel(
          participant: .assistant,
          markdownDocument: "GOOD"
        )),
      ]

      self.tableView.reloadData()
    }
  }
}
